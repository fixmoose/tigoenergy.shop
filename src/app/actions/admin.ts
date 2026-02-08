'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate } from '@/lib/email'

const MASTER_ADMIN_EMAIL = 'dejan@haywilson.com'

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
    if (!await checkIsAdmin()) throw new Error('Unauthorized')

    const supabase = await createAdminClient()

    // Create an invitation link using Supabase Auth
    const { data, error } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email: email,
        options: {
            data: { role: 'admin' },
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/sign-in`
        }
    })

    if (error) throw error

    // Send the custom email via UniOne
    const html = await renderTemplate('admin-invite', {
        invite_link: data.properties.action_link
    }, 'en')

    await sendEmail({
        to: email,
        subject: 'Invitation to Tigo Energy SHOP Admin Team',
        html
    })

    revalidatePath('/admin/settings')
    return { success: true }
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
        password: password || Math.random().toString(36).slice(-12), // random if not provided
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

    revalidatePath('/admin/customers/${id}')
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
