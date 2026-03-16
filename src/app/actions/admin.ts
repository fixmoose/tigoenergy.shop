'use server'

import { randomBytes } from 'node:crypto'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate } from '@/lib/email'
import { MARKETS } from '@/lib/constants/markets'
import { TRANSLATION_MAP, applyTemplateTranslation, ALL_APP_LANGUAGES } from '@/lib/template-translations'

const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || ''

/**
 * Checks if the current user is an admin (cookie-based)
 */
async function checkIsAdmin() {
    const cookieStore = await cookies()
    return cookieStore.get('tigo-admin')?.value === '1'
}

/**
 * Checks if the current user is the Master Admin (cookie-based + email match)
 */
async function checkIsMasterAdmin() {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') return false
    const supabase = await createAdminClient()
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
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
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
            html,
            emailType: 'admin_invite',
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

        // 2. Build VIES address if available
        const addresses: any[] = []
        if (is_b2b && formData.vies_address) {
            addresses.push({
                id: Math.random().toString(36).substr(2, 9),
                label: 'VIES Registered',
                street: formData.vies_address,
                city: '',
                postalCode: '',
                country: formData.vies_country || '',
                isViesAddress: true,
                isDefaultBilling: true,
                isDefaultShipping: true,
            })
        }

        // 3. Update Customer Profile (DB trigger creates the row on auth.users insert;
        //    we UPDATE with retries to ensure B2B fields + VIES address are saved)
        const updatePayload: any = {
            email,
            first_name,
            last_name,
            phone,
            is_b2b: !!is_b2b,
            company_name: formData.company_name || null,
            vat_id: formData.vat_id || null,
            customer_type: is_b2b ? 'b2b' : (customer_type || 'b2c'),
            account_status: 'active',
        }
        if (addresses.length > 0) updatePayload.addresses = addresses

        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, 400))
            const { error: profileError } = await supabase
                .from('customers')
                .update(updatePayload)
                .eq('id', authData.user.id)
            if (!profileError) break
            if (attempt === 2) console.warn('Profile update error:', profileError.message)
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
        await sendEmail({ to: customer.email, subject, html, skipUnsubscribe: true, emailType: 'b2b_verification' })

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
            await sendEmail({ to: order.customer_email, subject, html, skipUnsubscribe: true, orderId, emailType: 'delivery_notification' })
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

        // Find customer email and language
        const isEmail = identifier.includes('@')
        let emailToReset: string
        let locale = 'en'

        if (isEmail) {
            // Email passed directly — no DB lookup needed
            emailToReset = identifier
        } else {
            // UUID passed — try customers table first, fall back to Supabase Auth
            const { data: customer } = await supabase
                .from('customers')
                .select('id, email, preferred_language')
                .eq('id', identifier)
                .maybeSingle()

            if (customer) {
                emailToReset = customer.email
                locale = customer.preferred_language || 'en'
            } else {
                // Not in customers table — look up directly in Supabase Auth
                const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(identifier)
                if (authError || !authUser?.user?.email) throw new Error('Customer not found in auth system')
                emailToReset = authUser.user.email
            }
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
        if (!siteUrl) throw new Error('Site configuration error')

        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: emailToReset,
            options: { redirectTo: `${siteUrl}/auth/reset-password` }
        })

        if (linkError) throw linkError
        const resetLink = linkData.properties.action_link

        const subjectMap: Record<string, string> = {
            sl: 'Zahteva za ponastavitev gesla',
            de: 'Anforderung zum Zurücksetzen des Passworts',
            it: 'Richiesta di reimpostazione della password',
            fr: 'Demande de réinitialisation du mot de passe',
            hr: 'Zahtjev za poništavanje lozinke',
            cs: 'Žádost o obnovení hesla',
            pl: 'Prośba o reset hasła',
            nl: 'Verzoek om wachtwoord opnieuw in te stellen',
            pt: 'Pedido de redefinição de senha',
            es: 'Solicitud de restablecimiento de contraseña',
        }
        const buttonMap: Record<string, string> = {
            sl: 'Ponastavi geslo',
            de: 'Passwort zurücksetzen',
            it: 'Reimposta la password',
            fr: 'Réinitialiser le mot de passe',
            hr: 'Poništi lozinku',
            cs: 'Obnovit heslo',
            pl: 'Zresetuj hasło',
            nl: 'Wachtwoord opnieuw instellen',
            pt: 'Redefinir senha',
            es: 'Restablecer contraseña',
        }
        const subject = subjectMap[locale] || 'Password Reset Request'
        const buttonText = buttonMap[locale] || 'Reset Password'

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1a1a1a;background:#f9f9f9;margin:0;padding:0}
.wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5}
.hdr{background:#1a2b3c;padding:32px;color:#fff}.hdr h1{margin:0;font-size:22px;font-weight:900}
.hdr p{margin:6px 0 0;color:#9ca3af;font-size:13px}.bd{padding:32px}
.cta{display:inline-block;background:#1a2b3c;color:#fff;padding:14px 28px;border-radius:10px;font-weight:900;font-size:14px;text-decoration:none}
.link-box{background:#f3f4f6;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:11px;word-break:break-all;color:#374151;margin-top:16px}
</style></head><body><div class="wrap">
<div class="hdr"><h1>Password Reset</h1><p>A request was made to reset your account password.</p></div>
<div class="bd">
<p style="font-size:14px;color:#374151;margin-bottom:24px">Click the button below to set a new password. This link expires in 1 hour.</p>
<div style="text-align:center;margin:28px 0"><a href="${resetLink}" class="cta">${buttonText}</a></div>
<p style="font-size:12px;color:#6b7280">If the button doesn't work, copy and paste this link into your browser:</p>
<div class="link-box">${resetLink}</div>
<div style="padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;margin-top:24px">
<p>If you didn't request this, you can safely ignore this email.</p>
<p>Questions? <a href="mailto:support@tigoenergy.shop" style="color:#4b5563">support@tigoenergy.shop</a></p>
</div></div></div></body></html>`

        await sendEmail({
            to: emailToReset,
            subject,
            html,
            emailType: 'password_reset',
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
                order_number: orderPayload.order_number || `ETRG-MAN-${Date.now()}`,
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

function applyTranslation(html: string, targetLang: string): string {
    return applyTemplateTranslation(html, targetLang)
}

/**
 * Auto-translates a template from English to a target language
 */
export async function translateTemplateAction(sourceTemplateId: string, targetLang: string) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')

    const supabase = await createAdminClient()

    const { data: source, error: fetchError } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', sourceTemplateId)
        .single()

    if (fetchError || !source) throw new Error('Source template not found')

    const translatedHtml = applyTranslation(source.content_html, targetLang)
    const name = `${source.name?.replace(/\s*\([A-Z]{2}\)\s*$/, '')} (${targetLang.toUpperCase()})`

    // Upsert: update existing or insert new
    const { data: existing } = await supabase
        .from('document_templates')
        .select('id')
        .eq('type', source.type)
        .eq('language', targetLang)
        .limit(1)
        .single()

    let result
    if (existing) {
        const { data, error } = await supabase
            .from('document_templates')
            .update({ content_html: translatedHtml, name })
            .eq('id', existing.id)
            .select()
            .single()
        if (error) throw error
        result = data
    } else {
        const { data, error } = await supabase
            .from('document_templates')
            .insert({ type: source.type, language: targetLang, name, content_html: translatedHtml, is_active: true, is_default: true })
            .select()
            .single()
        if (error) throw error
        result = data
    }

    return { success: true, template: result }
}

/**
 * Syncs the English master template structure to all other saved language variants
 */
export async function syncTemplateToAllLanguagesAction(masterTemplateId: string) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')

    const supabase = await createAdminClient()

    const { data: master, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', masterTemplateId)
        .single()

    if (error || !master) throw new Error('Master template not found')
    if (master.language !== 'en') throw new Error('Sync must be initiated from an English template')

    // Fetch all saved non-English variants of the same type
    const { data: variants } = await supabase
        .from('document_templates')
        .select('id, language')
        .eq('type', master.type)
        .neq('language', 'en')

    const langs = ALL_APP_LANGUAGES

    const results = await Promise.all(langs.map(lang => translateTemplateAction(masterTemplateId, lang)))

    return { success: true, synced: langs, results }
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
    const stornoNumber = `ETRG-STORNO-${order.invoice_number}`

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
                html: personalizedHtml,
                emailType: 'marketing',
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
        internal_notes?: string;
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
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
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
                        html: welcomeHtml,
                        emailType: 'account_setup',
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
                internal_notes: order.internal_notes || null,
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
                html: ibanHtml,
                orderId: orderData.id,
                emailType: 'payment_request',
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
        const invoiceNumber = `ETRG-INV-${year}-${nextNumber.toString().padStart(4, '0')}`;

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

/**
 * Record a payment against an order (supports partial/multiple payments)
 */
export async function adminRecordPaymentAction(
    orderId: string,
    amount: number,
    paymentDate: string,
    paymentMethod?: string,
    reference?: string,
    notes?: string
) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        if (!amount || amount <= 0) throw new Error('Amount must be greater than 0')

        const supabase = await createAdminClient()

        // Get current order
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('id, total, amount_paid, payment_status')
            .eq('id', orderId)
            .single()

        if (orderErr || !order) throw new Error('Order not found')

        // Insert payment record
        const { error: insertErr } = await supabase
            .from('order_payments')
            .insert({
                order_id: orderId,
                amount,
                payment_date: paymentDate,
                payment_method: paymentMethod || 'bank_transfer',
                reference: reference || null,
                notes: notes || null,
            })

        if (insertErr) throw insertErr

        // Calculate new total paid
        const newAmountPaid = (order.amount_paid || 0) + amount
        const orderTotal = order.total || 0
        const newPaymentStatus = newAmountPaid >= orderTotal ? 'paid' : 'partially_paid'

        // Update order
        const updates: any = {
            amount_paid: newAmountPaid,
            payment_status: newPaymentStatus,
        }
        if (newPaymentStatus === 'paid') {
            updates.paid_at = new Date().toISOString()
        }

        const { error: updateErr } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', orderId)

        if (updateErr) throw updateErr

        revalidatePath(`/admin/orders/${orderId}`)
        return { success: true, newAmountPaid, paymentStatus: newPaymentStatus }
    } catch (err: any) {
        console.error('Error in adminRecordPaymentAction:', err)
        return { success: false, error: err.message || 'Failed to record payment' }
    }
}

/**
 * Fetch payment records for an order
 */
export async function getOrderPaymentsAction(orderId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        const supabase = await createAdminClient()

        const { data, error } = await supabase
            .from('order_payments')
            .select('*')
            .eq('order_id', orderId)
            .order('payment_date', { ascending: true })

        if (error) throw error
        return { success: true, data: data || [] }
    } catch (err: any) {
        return { success: false, error: err.message, data: [] }
    }
}

/**
 * Delete a payment record and recalculate order totals
 */
export async function adminDeletePaymentAction(paymentId: string, orderId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        const supabase = await createAdminClient()

        // Delete the payment
        const { error: delErr } = await supabase
            .from('order_payments')
            .delete()
            .eq('id', paymentId)

        if (delErr) throw delErr

        // Recalculate total paid from remaining payments
        const { data: remaining } = await supabase
            .from('order_payments')
            .select('amount')
            .eq('order_id', orderId)

        const newAmountPaid = (remaining || []).reduce((sum, p) => sum + (p.amount || 0), 0)

        // Get order total
        const { data: order } = await supabase
            .from('orders')
            .select('total')
            .eq('id', orderId)
            .single()

        const orderTotal = order?.total || 0
        const newPaymentStatus = newAmountPaid <= 0 ? 'unpaid' : newAmountPaid >= orderTotal ? 'paid' : 'partially_paid'

        await supabase
            .from('orders')
            .update({
                amount_paid: newAmountPaid,
                payment_status: newPaymentStatus,
                paid_at: newPaymentStatus === 'paid' ? new Date().toISOString() : null,
            })
            .eq('id', orderId)

        revalidatePath(`/admin/orders/${orderId}`)
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to delete payment' }
    }
}

/**
 * Process a bank statement (MT940/CAMT.053) and match transactions to unpaid orders.
 * Returns matched and unmatched credit transactions.
 */
export async function processBankStatementAction(fileContent: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const { parseBankStatement } = await import('@/lib/mt940-parser')
        const supabase = await createAdminClient()

        const statements = parseBankStatement(fileContent)
        if (statements.length === 0) {
            return { success: false, error: 'No valid statements found in the file. Please upload an MT940 (.sta) or CAMT.053 (.xml) file.' }
        }

        // Get all credits (incoming payments)
        const credits = statements.flatMap(s =>
            s.transactions.filter(t => t.type === 'credit')
        )

        if (credits.length === 0) {
            return { success: true, matched: [], unmatched: [], stats: { total: 0, credits: 0, debits: statements.flatMap(s => s.transactions).length } }
        }

        // Fetch all unpaid/partially paid orders
        const { data: orders, error: ordersErr } = await supabase
            .from('orders')
            .select('id, order_number, total, amount_paid, payment_status, customer_email, status')
            .in('payment_status', ['pending', 'unpaid', 'partially_paid'])
            .neq('status', 'cancelled')

        if (ordersErr) throw new Error('Failed to fetch orders: ' + ordersErr.message)

        const matched: {
            transactionDate: string
            transactionAmount: number
            transactionRef: string
            transactionDesc: string
            orderId: string
            orderNumber: string
            orderTotal: number
            amountPaid: number
            remaining: number
            confidence: 'high' | 'medium' | 'low'
        }[] = []
        const unmatched: typeof credits = []

        for (const credit of credits) {
            let bestMatch: typeof matched[0] | null = null
            let bestConfidence: 'high' | 'medium' | 'low' = 'low'

            for (const order of orders || []) {
                const remaining = (order.total || 0) - (order.amount_paid || 0)
                const refNormalized = credit.reference.toUpperCase().replace(/[\s-]/g, '')
                const orderNumNormalized = order.order_number.toUpperCase().replace(/[\s-]/g, '')
                const descNormalized = credit.description.toUpperCase().replace(/[\s-]/g, '')

                // Check if order number appears in reference or description
                const refHasOrderNum = refNormalized.includes(orderNumNormalized) || descNormalized.includes(orderNumNormalized)
                const amountMatches = Math.abs(credit.amount - remaining) < 0.02

                let confidence: 'high' | 'medium' | 'low' = 'low'
                if (refHasOrderNum && amountMatches) {
                    confidence = 'high'
                } else if (refHasOrderNum) {
                    confidence = 'medium'
                } else if (amountMatches && remaining > 50) {
                    // Amount match alone is only useful for larger, unique amounts
                    confidence = 'low'
                } else {
                    continue
                }

                const confRank = { high: 3, medium: 2, low: 1 }
                if (!bestMatch || confRank[confidence] > confRank[bestConfidence]) {
                    bestMatch = {
                        transactionDate: credit.date,
                        transactionAmount: credit.amount,
                        transactionRef: credit.reference,
                        transactionDesc: credit.description,
                        orderId: order.id,
                        orderNumber: order.order_number,
                        orderTotal: order.total || 0,
                        amountPaid: order.amount_paid || 0,
                        remaining,
                        confidence,
                    }
                    bestConfidence = confidence
                }
            }

            if (bestMatch) {
                matched.push(bestMatch)
            } else {
                unmatched.push(credit)
            }
        }

        // Sort: high confidence first
        matched.sort((a, b) => {
            const rank = { high: 3, medium: 2, low: 1 }
            return rank[b.confidence] - rank[a.confidence]
        })

        return {
            success: true,
            matched,
            unmatched,
            stats: {
                total: statements.flatMap(s => s.transactions).length,
                credits: credits.length,
                debits: statements.flatMap(s => s.transactions).filter(t => t.type === 'debit').length,
                matchedCount: matched.length,
                unmatchedCount: unmatched.length,
                accounts: statements.map(s => s.accountId).filter(Boolean),
            },
        }
    } catch (err: any) {
        console.error('Error processing bank statement:', err)
        return { success: false, error: err.message || 'Failed to process bank statement' }
    }
}

/**
 * Confirm matched payments from bank statement — records them as actual payments.
 */
export async function confirmBankStatementMatchesAction(
    matches: { orderId: string; amount: number; date: string; reference: string }[]
) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const results: { orderId: string; success: boolean; error?: string }[] = []

        for (const match of matches) {
            const result = await adminRecordPaymentAction(
                match.orderId,
                match.amount,
                match.date,
                'bank_transfer',
                match.reference,
                'Auto-matched from bank statement'
            )
            results.push({
                orderId: match.orderId,
                success: result.success,
                error: result.success ? undefined : result.error,
            })
        }

        revalidatePath('/admin/orders')
        return { success: true, results }
    } catch (err: any) {
        console.error('Error confirming bank statement matches:', err)
        return { success: false, error: err.message || 'Failed to confirm matches' }
    }
}

/**
 * Fetch email logs for an order
 */
export async function getOrderEmailLogsAction(orderId: string) {
    if (!await checkIsAdmin()) throw new Error('Unauthorized')
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('sent_at', { ascending: false })
    if (error) return { success: false, error: error.message }
    return { success: true, data }
}
