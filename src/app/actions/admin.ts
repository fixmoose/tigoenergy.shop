'use server'

import { randomBytes } from 'node:crypto'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate } from '@/lib/email'

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
    console.log(`Starting invitation for: ${email}`)
    try {
        if (!await checkIsAdmin()) {
            console.error('Permission denied: User is not an admin.')
            throw new Error('Unauthorized')
        }

        console.log('Creating admin client...')
        const supabase = await createAdminClient()

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        if (!siteUrl) {
            console.error('NEXT_PUBLIC_SITE_URL is not defined in environment variables.')
            throw new Error('Site configuration error')
        }

        console.log(`Generating invitation link for ${email} with redirect to ${siteUrl}/admin/sign-in`)
        // Create an invitation link using Supabase Auth
        const { data, error } = await supabase.auth.admin.generateLink({
            type: 'invite',
            email: email,
            options: {
                data: { role: 'admin' },
                redirectTo: `${siteUrl}/admin/sign-in`
            }
        })

        if (error) {
            console.error('Supabase generateLink error:', error)
            throw error
        }

        console.log('Invitation link generated. Rendering email template...')
        // Send the custom email via UniOne
        const html = await renderTemplate('admin-invite', {
            invite_link: data.properties.action_link
        }, 'en')

        console.log('Template rendered. Sending email via UniOne...')
        await sendEmail({
            to: email,
            subject: 'Invitation to Tigo Energy SHOP Admin Team',
            html
        })

        console.log('Email sent successfully. Revalidating path...')
        revalidatePath('/admin/settings')
        return { success: true }
    } catch (err: any) {
        console.error('Error in inviteAdminAction:', err)
        throw new Error(err.message || 'An unexpected error occurred during admin invitation')
    }
}

/**
 * Delete an admin user (Only Master Admin)
 */
export async function deleteAdminAction(userId: string) {
    if (!await checkIsMasterAdmin()) throw new Error('Only Master Admin can delete other admins')

    const supabase = await createAdminClient()

    // Check if target is not Master Admin itself
    const { data: user } = await supabase.auth.admin.getUserById(userId)
    if (user?.user?.email === MASTER_ADMIN_EMAIL) throw new Error('Cannot delete Master Admin')

    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error

    revalidatePath('/admin/settings')
    return { success: true }
}

/**
 * Admin creates a customer (Auth + Profile)
 */
export async function adminCreateCustomerAction(formData: any) {
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

    // Profile is usually created by DB trigger, but if not:
    const { error: profileError } = await supabase.from('customers').insert({
        id: authData.user.id,
        email,
        first_name,
        last_name,
        phone,
        is_b2b: !!is_b2b,
        company_name: formData.company_name,
        vat_id: formData.vat_id,
        vat_number: formData.vat_id, // Keep both in sync
        customer_type: is_b2b ? 'b2b' : (customer_type || 'b2c'),
        account_status: 'active'
    })

    // If it fails because of trigger, wrap in try/catch or ignore duplicate
    if (profileError && !profileError.message.includes('duplicate key')) {
        console.warn('Profile creation error (might be handled by trigger):', profileError.message)
    }

    revalidatePath('/admin/customers')
    return { success: true, userId: authData.user.id }
}

/**
 * Admin updates customer info
 */
export async function adminUpdateCustomerAction(id: string, updates: any) {
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
}

/**
 * Admin deletes a customer (and their auth account)
 */
export async function adminDeleteCustomerAction(id: string) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')

    const supabase = await createAdminClient()

    // 1. Delete from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(id)
    if (authError) {
        console.error('Error deleting auth user:', authError)
        // We continue anyway to try and clean up the database record
    }

    // 2. Delete from customers table
    const { error: dbError } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

    if (dbError) throw dbError

    revalidatePath('/admin/customers')
    return { success: true }
}

/**
 * Admin triggers a password reset for a customer
 */
export async function adminResetCustomerPasswordAction(customerId: string) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')

    try {
        const supabase = await createAdminClient()

        // 1. Get the customer email
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('email')
            .eq('id', customerId)
            .single()

        if (fetchError || !customer) throw new Error('Customer not found')

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        if (!siteUrl) throw new Error('Site configuration error')

        // 2. Generate the recovery link
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: customer.email,
            options: {
                redirectTo: `${siteUrl}/auth/reset-password`
            }
        })

        if (linkError) throw linkError

        // 3. Render and send the email
        const html = await renderTemplate('password-reset', {
            reset_link: linkData.properties.action_link
        }, 'en') // Defaulting to en, could be expanded to use customer.language

        await sendEmail({
            to: customer.email,
            subject: 'Password Reset Request',
            html
        })

        return { success: true }
    } catch (err: any) {
        console.error('Error in adminResetCustomerPasswordAction:', err)
        throw new Error(err.message || 'Failed to trigger password reset')
    }
}

/**
 * Admin creates an order
 */
export async function adminCreateOrderAction(payload: any) {
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
    return { success: true, orderId: order.id }
}

/**
 * Get list of admins
 */
export async function getAdminsAction() {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')

    const supabase = await createAdminClient()
    const { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) throw error

    return users
        .filter(u => u.user_metadata?.role === 'admin' || u.email === MASTER_ADMIN_EMAIL)
        .map(u => ({
            id: u.id,
            email: u.email,
            role: u.email === MASTER_ADMIN_EMAIL ? 'Master Admin' : 'Admin',
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at
        }))
}

/**
 * Admin creates an order with items
 */
export async function adminCreateFullOrderAction(orderPayload: any, items: any[]) {
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
    return { success: true, orderId: order.id }
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
        shipping_cost: number;
        vat_rate: number;
        items: any[];
        payment_method?: string;
    };
}) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized');

    const supabase = await createAdminClient();
    const { customer, order } = payload;

    // 1. Find or Create Customer
    let customerId: string | null = null;
    const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
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

        // Create Customer Profile
        const { error: profileError } = await supabase.from('customers').insert({
            id: customerId,
            email: customer.email,
            first_name: customer.first_name,
            last_name: customer.last_name,
            company_name: customer.company_name,
            vat_id: customer.vat_id,
            vat_number: customer.vat_id,
            phone: customer.phone,
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
                const welcomeHtml = await renderTemplate('admin-account-setup', {
                    name: `${customer.first_name} ${customer.last_name}`,
                    setup_link: linkData.properties.action_link
                }, 'en');

                await sendEmail({
                    to: customer.email,
                    subject: 'Activate Your Tigo Energy SHOP Account',
                    html: welcomeHtml
                });
            }
        } catch (emailErr) {
            console.error('Failed to send password setup email:', emailErr);
        }
    }

    // 2. Calculate Totals
    const subtotal = order.items.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0);
    const vatAmount = (subtotal + order.shipping_cost) * (order.vat_rate / 100);
    const total = subtotal + order.shipping_cost + vatAmount;

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
            total,
            subtotal,
            vat_rate: order.vat_rate,
            vat_amount: vatAmount,
            shipping_cost: order.shipping_cost,
            market: order.market,
            language: 'en',
            payment_method: order.payment_method || 'IBAN',
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
        const itemsHtml = generateItemsTableHtml(itemsWithOrderId);
        
        const ibanHtml = await renderTemplate('order-iban-payment', {
            name: `${customer.first_name} ${customer.last_name}`,
            order_number: orderNumber,
            order_date: new Date().toLocaleDateString('en-GB'),
            total_amount: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(total),
            order_items: itemsHtml
        }, 'en');

        await sendEmail({
            to: customer.email,
            subject: `Order #${orderNumber} Confirmation - Payment Required`,
            html: ibanHtml
        });
    } catch (emailErr) {
        console.error('Failed to send IBAN email:', emailErr);
    }

    revalidatePath('/admin/orders');
    return { success: true, orderId: orderData.id };
}
