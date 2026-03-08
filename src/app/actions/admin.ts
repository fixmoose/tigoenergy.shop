'use server'

import { randomBytes } from 'node:crypto'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate } from '@/lib/email'
import { MARKETS } from '@/lib/constants/markets'

const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || ''

/**
 * Checks if the current user is an admin
 */
async function checkIsAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.user_metadata?.role === 'admin'
}

/**
 * Checks if the current user is the Master Admin
 */
async function checkIsMasterAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email === MASTER_ADMIN_EMAIL
}

/**
 * Invite a new admin
 */
export async function inviteAdminAction(email: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        if (!siteUrl) throw new Error('Site configuration error')

        const { data, error } = await supabase.auth.admin.generateLink({
            type: 'invite',
            email: email,
            options: {
                data: { role: 'admin' },
                redirectTo: `${siteUrl}/admin/sign-in`
            }
        })

        if (error) throw error

        const html = await renderTemplate('admin-invite', {
            invite_link: data.properties.action_link
        }, 'en')

        await sendEmail({
            to: email,
            subject: 'Invitation to Tigo Energy SHOP Admin Team',
            html
        })

        revalidatePath('/admin/settings')
        return { success: true, data }
    } catch (err: any) {
        console.error('Error in inviteAdminAction:', err)
        return { success: false, error: err.message || 'Failed to invite admin' }
    }
}

/**
 * Delete an admin user (Only Master Admin)
 */
export async function deleteAdminAction(userId: string) {
    try {
        if (!await checkIsMasterAdmin()) throw new Error('Only Master Admin can delete other admins')

        const supabase = await createAdminClient()

        // Check if target is not Master Admin itself
        const { data: user } = await supabase.auth.admin.getUserById(userId)
        if (user?.user?.email === MASTER_ADMIN_EMAIL) throw new Error('Cannot delete Master Admin')

        const { error } = await supabase.auth.admin.deleteUser(userId)
        if (error) throw error

        revalidatePath('/admin/settings')
        return { success: true }
    } catch (err: any) {
        console.error('Error in deleteAdminAction:', err)
        return { success: false, error: err.message || 'Failed to delete admin' }
    }
}

/**
 * Admin creates a customer (Auth + Profile)
 */
export async function adminCreateCustomerAction(formData: any) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()
        const { email, first_name, last_name, phone, is_b2b, customer_type, password } = formData

        // 1. Create Auth User
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: password || randomBytes(16).toString('base64url'),
            email_confirm: true,
            user_metadata: {
                first_name,
                last_name,
                phone,
                customer_type: is_b2b ? 'b2b' : (customer_type || 'b2c')
            }
        })

        if (authError) throw authError

        // 2. Create Customer Profile
        const { error: profileError } = await supabase.from('customers').insert({
            id: authData.user.id,
            email,
            first_name,
            last_name,
            phone,
            is_b2b: !!is_b2b,
            company_name: formData.company_name,
            vat_id: formData.vat_id,
            vat_number: formData.vat_id,
            customer_type: is_b2b ? 'b2b' : (customer_type || 'b2c'),
            account_status: 'active'
        })

        if (profileError && !profileError.message.includes('duplicate key')) {
            console.warn('Profile creation error:', profileError.message)
        }

        revalidatePath('/admin/customers')
        return { success: true, data: { userId: authData.user.id } }
    } catch (err: any) {
        console.error('Error in adminCreateCustomerAction:', err)
        return { success: false, error: err.message || 'Failed to create customer' }
    }
}

/**
 * Admin verifies B2B customer (marks as VIES-verified and notifies them)
 */
export async function adminVerifyB2BCustomerAction(customerId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('email, first_name, last_name, company_name, preferred_language')
            .eq('id', customerId)
            .single()

        if (fetchError || !customer) throw new Error('Customer not found')

        await supabase.from('customers').update({ is_b2b: true, account_status: 'active' }).eq('id', customerId)
        await supabase.auth.admin.updateUserById(customerId, {
            user_metadata: { customer_type: 'b2b', b2b_verified: true }
        })

        const locale = customer.preferred_language || 'en'
        const html = await renderTemplate('b2b-vies-verified', {}, locale)
        const subjectMap: Record<string, string> = {
            sl: 'Vaš B2B račun je potrjen — Tigo Energy SHOP',
            de: 'Ihr B2B-Konto wurde verifiziert — Tigo Energy SHOP',
            it: 'Il tuo account B2B è stato verificato — Tigo Energy SHOP',
            fr: 'Votre compte B2B a été vérifié — Tigo Energy SHOP',
        }
        const subject = subjectMap[locale] || 'Your B2B Account is Verified — Tigo Energy SHOP'
        await sendEmail({ to: customer.email, subject, html, skipUnsubscribe: true })

        revalidatePath(`/admin/customers/${customerId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in adminVerifyB2BCustomerAction:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Admin marks order as delivered and notifies the customer
 */
export async function adminMarkDeliveredAction(orderId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        const { data: order, error } = await supabase
            .from('orders')
            .update({ status: 'delivered', delivered_at: new Date().toISOString() })
            .eq('id', orderId)
            .select('*, order_items(*)')
            .single()

        if (error || !order) throw new Error('Order not found')

        const locale = order.language || 'en'
        const customerName = (order.shipping_address as any)?.first_name || order.customer_email

        try {
            const html = await renderTemplate('delivered', {
                name: customerName,
                order_number: String(order.order_number),
            }, locale)
            const subjectMap: Record<string, string> = {
                sl: `Vaše naročilo #${order.order_number} je dostavljeno`,
                de: `Ihre Bestellung #${order.order_number} wurde geliefert`,
                it: `Il tuo ordine #${order.order_number} è stato consegnato`,
                fr: `Votre commande #${order.order_number} a été livrée`,
            }
            const subject = subjectMap[locale] || `Your Order #${order.order_number} Has Been Delivered`
            await sendEmail({ to: order.customer_email, subject, html, skipUnsubscribe: true })
        } catch (emailErr) {
            console.error('Failed to send delivered email:', emailErr)
        }

        revalidatePath(`/admin/orders/${orderId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in adminMarkDeliveredAction:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Admin updates customer info
 */
export async function adminUpdateCustomerAction(id: string, updates: any) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        // Update Profile
        const { error: profileError } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', id)

        if (profileError) throw profileError

        // Update Auth Metadata if relevant fields changed
        if (updates.first_name || updates.last_name || updates.phone || updates.customer_type) {
            await supabase.auth.admin.updateUserById(id, {
                user_metadata: {
                    first_name: updates.first_name,
                    last_name: updates.last_name,
                    phone: updates.phone,
                    customer_type: updates.customer_type
                }
            })
        }

        revalidatePath(`/admin/customers/${id}`)
        revalidatePath('/admin/customers')
        return { success: true }
    } catch (err: any) {
        console.error('Error in adminUpdateCustomerAction:', err)
        return { success: false, error: err.message || 'Failed to update customer' }
    }
}

/**
 * Admin deletes a customer (and their auth account)
 */
export async function adminDeleteCustomerAction(id: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        // 1. Delete from Supabase Auth
        const { error: authError } = await supabase.auth.admin.deleteUser(id)
        if (authError) {
            console.error('Error deleting auth user:', authError)
        }

        // 2. Delete from customers table
        const { error: dbError } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)

        if (dbError) throw dbError

        revalidatePath('/admin/customers')
        return { success: true }
    } catch (err: any) {
        console.error('Error in adminDeleteCustomerAction:', err)
        return { success: false, error: err.message || 'Failed to delete customer' }
    }
}

/**
 * Admin triggers a password reset for a customer
 */
export async function adminResetCustomerPasswordAction(identifier: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        // Find customer by ID or Email
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('id, email, preferred_language')
            .or(`id.eq."${identifier}",email.eq."${identifier}"`)
            .maybeSingle()

        if (fetchError || !customer) throw new Error('Customer not found')

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        if (!siteUrl) throw new Error('Site configuration error')

        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: customer.email,
            options: { redirectTo: `${siteUrl}/auth/reset-password` }
        })

        if (linkError) throw linkError

        const locale = customer.preferred_language || 'en'
        const html = await renderTemplate('password-reset', {
            reset_link: linkData.properties.action_link
        }, locale)

        const subjectMap: Record<string, string> = {
            sl: 'Zahteva za ponastavitev gesla',
            de: 'Anforderung zum Zurücksetzen des Passworts',
            it: 'Richiesta di reimpostazione della password',
            fr: 'Demande de réinitialisation du mot de passe',
        }
        await sendEmail({
            to: customer.email,
            subject: subjectMap[locale] || 'Password Reset Request',
            html
        })

        return { success: true }
    } catch (err: any) {
        console.error('Error in adminResetCustomerPasswordAction:', err)
        return { success: false, error: err.message || 'Failed to trigger password reset' }
    }
}

/**
 * Admin creates an order
 */
export async function adminCreateOrderAction(payload: any) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                ...payload,
                status: payload.status || 'pending',
                created_at: payload.created_at || new Date().toISOString()
            })
            .select()
            .single()

        if (error) throw error

        revalidatePath('/admin/orders')
        return { success: true, data: { orderId: order.id } }
    } catch (err: any) {
        console.error('Error in adminCreateOrderAction:', err)
        return { success: false, error: err.message || 'Failed to create order' }
    }
}

/**
 * Get list of admins
 */
export async function getAdminsAction() {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()
        const { data: { users }, error } = await supabase.auth.admin.listUsers()

        if (error) throw error

        const admins = users
            .filter(u => u.user_metadata?.role === 'admin' || u.email === MASTER_ADMIN_EMAIL)
            .map(u => ({
                id: u.id,
                email: u.email,
                role: u.email === MASTER_ADMIN_EMAIL ? 'Master Admin' : 'Admin',
                created_at: u.created_at,
                last_sign_in_at: u.last_sign_in_at
            }))

        return { success: true, data: admins }
    } catch (err: any) {
        console.error('Error in getAdminsAction:', err)
        return { success: false, error: err.message || 'Failed to fetch admins' }
    }
}

/**
 * Admin creates an order with items
 */
export async function adminCreateFullOrderAction(orderPayload: any, items: any[]) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        // 1. Create Order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                ...orderPayload,
                order_number: orderPayload.order_number || `MAN-${Date.now()}`,
                status: orderPayload.status || 'pending',
                created_at: orderPayload.created_at || new Date().toISOString()
            })
            .select()
            .single()

        if (orderError) throw orderError

        // 2. Create Items
        if (items && items.length > 0) {
            const itemsWithOrderId = items.map(i => ({ ...i, order_id: order.id }))
            const { error: itemsError } = await supabase.from('order_items').insert(itemsWithOrderId)
            if (itemsError) throw itemsError
        }

        revalidatePath('/admin/orders')
        return { success: true, data: { orderId: order.id } }
    } catch (err: any) {
        console.error('Error in adminCreateFullOrderAction:', err)
        return { success: false, error: err.message || 'Failed to create full order' }
    }
}

/**
 * Auto-translates a template from English to a target language
 */
export async function translateTemplateAction(sourceTemplateId: string, targetLang: string) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')

    const supabase = await createAdminClient()

    // 1. Get source template
    const { data: source, error: fetchError } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', sourceTemplateId)
        .single()

    if (fetchError || !source) throw new Error('Source template not found')

    // 2. Perform translation (Simple replacement of common terms for now)
    // In a real app, this would call GPT/DeepL API
    let translatedHtml = source.content_html
    const name = `${source.type.replace('_', ' ').toUpperCase()} (${targetLang.toUpperCase()})`

    // Simple translation map for demo
    const translations: any = {
        de: { 'Invoice': 'Rechnung', 'Order': 'Bestellung', 'Price': 'Preis', 'Total': 'Gesamt', 'Date': 'Datum', 'Confirmation': 'Bestätigung', 'Official': 'Offizielle' },
        sl: { 'Invoice': 'Račun', 'Order': 'Naročilo', 'Price': 'Cena', 'Total': 'Skupaj', 'Date': 'Datum', 'Confirmation': 'Potrditev', 'Official': 'Uradni' },
        fr: { 'Invoice': 'Facture', 'Order': 'Commande', 'Price': 'Prix', 'Total': 'Total', 'Date': 'Date', 'Confirmation': 'Confirmation', 'Official': 'Officielle' },
        it: { 'Invoice': 'Fattura', 'Order': 'Ordine', 'Price': 'Prezzo', 'Total': 'Totale', 'Date': 'Data', 'Confirmation': 'Conferma', 'Official': 'Ufficiale' },
        es: { 'Invoice': 'Factura', 'Order': 'Pedido', 'Price': 'Precio', 'Total': 'Total', 'Date': 'Fecha', 'Confirmation': 'Confirmación', 'Official': 'Oficial' }
    }

    if (translations[targetLang]) {
        Object.entries(translations[targetLang]).forEach(([en, target]) => {
            const regex = new RegExp(en, 'gi')
            translatedHtml = translatedHtml.replace(regex, target as string)
        })
    }

    // 3. Save as new template
    const { data: newTemplate, error: insertError } = await supabase
        .from('document_templates')
        .insert({
            type: source.type,
            language: targetLang,
            name: name,
            content_html: translatedHtml,
            is_active: true,
            is_default: false
        })
        .select()
        .single()

    if (insertError) throw insertError

    return { success: true, template: newTemplate }
}

/**
 * Admin approves a return and issues a Storno invoice
 */
export async function adminApproveReturnAction(returnId: string) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')

    const supabase = await createAdminClient()

    // 1. Get Return & Order details
    const { data: returnReq, error: fetchError } = await supabase
        .from('order_returns')
        .select('*, orders(*)')
        .eq('id', returnId)
        .single()

    if (fetchError || !returnReq) throw new Error('Return request not found')

    const order = returnReq.orders
    if (!order.invoice_number) {
        throw new Error('Cannot issue Storno invoice for an order that has no official invoice yet.')
    }

    // 2. Update Return Status
    const { error: updateError } = await supabase
        .from('order_returns')
        .update({ status: 'approved', processed_at: new Date().toISOString() })
        .eq('id', returnId)

    if (updateError) throw updateError

    // 3. Prepare Storno Metadata
    const stornoNumber = `STORNO-${order.invoice_number}`

    // In a real system, we might save this to a 'storno_invoices' table or update the order
    // But per instructions, we just need the template and logic to be ready.
    // We can update the internal notes or a specific field if it exists.
    await supabase.from('orders').update({
        internal_notes: `${order.internal_notes || ''}\n[${new Date().toLocaleDateString()}] Storno Invoice issued: ${stornoNumber}`
    }).eq('id', order.id)

    revalidatePath('/admin/returns')
    revalidatePath(`/admin/orders/${order.id}`)

    return {
        success: true,
        stornoNumber,
        message: `Return approved and Storno Invoice ${stornoNumber} generated.`
    }
}

/**
 * Marketing Actions
 */

export async function adminGetMarketingAudienceAction() {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')
    const supabase = await createAdminClient()

    const { data, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, phone, is_b2b, customer_type')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export async function adminGetMarketingLettersAction() {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')
    const supabase = await createAdminClient()

    const { data, error } = await supabase
        .from('marketing_letters')
        .select('*')
        .order('updated_at', { ascending: false })

    if (error) throw error
    return data
}

export async function adminSaveMarketingLetterAction(letter: { id?: string, title: string, content_html: string }) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')
    const supabase = await createAdminClient()

    if (letter.id) {
        const { error } = await supabase
            .from('marketing_letters')
            .update({
                title: letter.title,
                content_html: letter.content_html,
                updated_at: new Date().toISOString()
            })
            .eq('id', letter.id)
        if (error) throw error
    } else {
        const { error } = await supabase
            .from('marketing_letters')
            .insert({
                title: letter.title,
                content_html: letter.content_html
            })
        if (error) throw error
    }

    revalidatePath('/admin/marketing')
    return { success: true }
}

export async function adminDeleteMarketingLetterAction(id: string) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')
    const supabase = await createAdminClient()

    const { error } = await supabase
        .from('marketing_letters')
        .delete()
        .eq('id', id)

    if (error) throw error
    revalidatePath('/admin/marketing')
    return { success: true }
}

export async function adminSendBulkMarketingEmailAction(letterId: string, customerIds: string[]) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')
    const supabase = await createAdminClient()
    const { sendEmail } = await import('@/lib/email')

    // 1. Get the letter
    const { data: letter, error: letterError } = await supabase
        .from('marketing_letters')
        .select('*')
        .eq('id', letterId)
        .single()

    if (letterError || !letter) throw new Error('Letter not found')

    // 2. Get the customers
    const { data: customers, error: customerError } = await supabase
        .from('customers')
        .select('email, first_name, last_name')
        .in('id', customerIds)

    if (customerError) throw customerError

    // 3. Send emails
    const results = {
        sent: 0,
        failed: 0,
        errors: [] as string[]
    }

    // In a real production app, we'd use a background queue or batch sending
    // For now, we'll loop (UniOne supports single recipients in sendEmail)
    for (const customer of customers) {
        if (!customer.email) continue
        try {
            // Basic placeholder replacement
            let personalizedHtml = letter.content_html
                .replace(/{first_name}/g, customer.first_name || '')
                .replace(/{last_name}/g, customer.last_name || '')

            await sendEmail({
                to: customer.email,
                subject: letter.title,
                html: personalizedHtml
            })
            results.sent++
        } catch (err: any) {
            results.failed++
            results.errors.push(`${customer.email}: ${err.message}`)
        }
    }

    return results
}

/**
 * Admin creates a complete order from scratch, including customer creation and emails
 */
export async function adminCreateOrderWithCustomerAction(payload: {
    customer: {
        email: string;
        first_name: string;
        last_name: string;
        company_name?: string;
        vat_id?: string;
        phone?: string;
        is_b2b?: boolean;
    };
    order: {
        market: string;
        language?: string;
        shipping_cost: number;
        vat_rate: number;
        items: any[];
        payment_method?: string;
        shipping_address: {
            street: string;
            city: string;
            postal_code: string;
            country: string;
            street2?: string;
        };
        billing_address?: {
            street: string;
            city: string;
            postal_code: string;
            country: string;
            street2?: string;
        };
    };
}) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized');

        const supabase = await createAdminClient();
        const { customer, order } = payload;

        // 1. Find or Create Customer
        let customerId: string | null = null;
        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id, first_name, last_name, company_name, vat_id, phone, is_b2b')
            .eq('email', customer.email)
            .maybeSingle();

        if (existingCustomer) {
            customerId = existingCustomer.id;
        } else {
            // Create Auth User
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: customer.email,
                password: randomBytes(24).toString('base64url'),
                email_confirm: true,
                user_metadata: {
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    customer_type: customer.is_b2b ? 'b2b' : 'b2c'
                }
            });

            if (authError) throw authError;
            customerId = authData.user.id;

            const { error: profileError } = await supabase.from('customers').insert({
                id: customerId,
                email: customer.email,
                first_name: customer.first_name || '',
                last_name: customer.last_name || '',
                company_name: customer.company_name || null,
                vat_id: customer.vat_id || null,
                vat_number: customer.vat_id || null,
                phone: customer.phone || '',
                is_b2b: !!customer.is_b2b,
                customer_type: customer.is_b2b ? 'b2b' : 'b2c',
                account_status: 'active'
            });

            if (profileError) console.error('Profile creation error:', profileError);

            // Send Password Setup Email
            try {
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
                const { data: linkData } = await supabase.auth.admin.generateLink({
                    type: 'recovery',
                    email: customer.email,
                    options: { redirectTo: `${siteUrl}/auth/reset-password` }
                });

                if (linkData?.properties?.action_link) {
                    const setupLocale = order.language || 'en';
                    const welcomeHtml = await renderTemplate('admin-account-setup', {
                        name: `${customer.first_name} ${customer.last_name}`,
                        setup_link: linkData.properties.action_link
                    }, setupLocale);

                    const setupSubjectMap: Record<string, string> = {
                        sl: 'Aktivirajte svoj račun Tigo Energy SHOP',
                        de: 'Aktivieren Sie Ihr Tigo Energy SHOP-Konto',
                        it: 'Attiva il tuo account Tigo Energy SHOP',
                        fr: 'Activez votre compte Tigo Energy SHOP',
                    };
                    await sendEmail({
                        to: customer.email,
                        subject: setupSubjectMap[setupLocale] || 'Activate Your Tigo Energy SHOP Account',
                        html: welcomeHtml
                    });
                }
            } catch (emailErr) {
                console.error('Failed to send password setup email:', emailErr);
            }
        }

        // 2. Calculate Totals
        const subtotal = (order.items || []).reduce((acc: number, item: any) => {
            const up = parseFloat(item.unit_price) || 0;
            const q = parseInt(item.quantity) || 0;
            return acc + (up * q);
        }, 0);

        const shipCost = parseFloat(order.shipping_cost as any) || 0;
        const vRate = parseFloat(order.vat_rate as any) || 0;

        const vatAmount = (subtotal + shipCost) * (vRate / 100);
        const total = subtotal + shipCost + vatAmount;

        // 3. Create Order
        const orderNumber = `MAN-${Date.now()}`;
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert({
                customer_id: customerId,
                customer_email: customer.email,
                customer_phone: customer.phone,
                company_name: customer.company_name,
                vat_id: customer.vat_id,
                order_number: orderNumber,
                status: 'pending',
                payment_status: 'unpaid',
                shipping_address: {
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    ...order.shipping_address
                },
                billing_address: order.billing_address ? {
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    ...order.billing_address
                } : {
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    ...order.shipping_address
                },
                total,
                subtotal,
                vat_rate: vRate,
                vat_amount: vatAmount,
                shipping_cost: shipCost,
                market: order.market || 'de',
                language: 'en',
                payment_method: order.payment_method || 'IBAN',
                is_b2b: customer.is_b2b || false,
                delivery_country: order.shipping_address?.country || 'DE',
                transaction_type: (order.shipping_address?.country === 'SI')
                    ? 'domestic'
                    : (Object.values(MARKETS).some(m => m.country === order.shipping_address?.country && m.isEU) ? 'eu' : 'export'),
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 4. Create Order Items
        const itemsWithOrderId = order.items.map(i => ({
            order_id: orderData.id,
            product_id: i.product_id,
            sku: i.sku,
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.unit_price * i.quantity
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(itemsWithOrderId);
        if (itemsError) throw itemsError;

        // 5. Send IBAN Payment Email
        try {
            const { generateItemsTableHtml } = await import('@/lib/document-service');
            const itemsHtml = generateItemsTableHtml(itemsWithOrderId, '€', true);

            const ibanLocale = order.language || 'en';
            const ibanHtml = await renderTemplate('order-iban-payment', {
                name: `${customer.first_name} ${customer.last_name}`,
                order_number: orderNumber,
                order_date: new Date().toLocaleDateString('en-GB'),
                total_amount: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(total),
                order_items: itemsHtml
            }, ibanLocale);

            const ibanSubjectMap: Record<string, string> = {
                sl: `Naročilo #${orderNumber} — plačilo potrebno`,
                de: `Bestellung #${orderNumber} Bestätigung — Zahlung erforderlich`,
                it: `Ordine #${orderNumber} Conferma — Pagamento richiesto`,
                fr: `Commande #${orderNumber} Confirmation — Paiement requis`,
            };
            await sendEmail({
                to: customer.email,
                subject: ibanSubjectMap[ibanLocale] || `Order #${orderNumber} Confirmation - Payment Required`,
                html: ibanHtml
            });
        } catch (emailErr) {
            console.error('Failed to send IBAN email:', emailErr);
        }

        console.log(`[AdminOrder] Order #${orderNumber} created successfully for ${customer.email}`);

        try {
            revalidatePath('/admin/orders');
        } catch (e) {
            console.error('Revalidation failed:', e);
        }

        return { success: true, orderNumber, data: { orderId: orderData.id } };
    } catch (err: any) {
        console.error('CRITICAL ERROR in adminCreateOrderWithCustomerAction:', err);
        return { success: false, error: err.message || 'Failed to create order. Please check server logs.' }
    }
}

/**
 * Issues an invoice for an existing order
 */
export async function issueOrderInvoiceAction(orderId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized');

        const supabase = await createClient();

        // 1. Get current order to ensure it exists and doesn't have an invoice yet
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('order_number, invoice_number, status')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) throw new Error('Order not found');
        if (order.invoice_number) return { success: true, message: 'Invoice already exists' };

        // 2. Generate Invoice Number (e.g. INV-2026-XXXX)
        const year = new Date().getFullYear();
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .not('invoice_number', 'is', null)
            .gte('invoice_created_at', `${year}-01-01`);

        const nextNumber = (count || 0) + 1;
        const invoiceNumber = `INV-${year}-${nextNumber.toString().padStart(4, '0')}`;

        // 3. Update Order
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                invoice_number: invoiceNumber,
                invoice_created_at: new Date().toISOString(),
                // Simulate a PDF URL for now - in production this would be a real signed URL
                invoice_url: `/api/orders/${orderId}/invoice?download=1`,
                status: order.status === 'pending' ? 'processing' : order.status
            })
            .eq('id', orderId);

        if (updateError) throw updateError;

        revalidatePath(`/admin/orders/${orderId}`);
        revalidatePath('/admin/invoices');
        revalidatePath('/admin/reporting/oss');

        return { success: true, invoiceNumber };
    } catch (err: any) {
        console.error('Error in issueOrderInvoiceAction:', err);
        return { success: false, error: err.message || 'Failed to issue invoice' };
    }
}
