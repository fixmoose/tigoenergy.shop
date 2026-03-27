'use server'

import { randomBytes } from 'node:crypto'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate, getEmailTranslations } from '@/lib/email'
import { MARKETS, getDomainForMarket } from '@/lib/constants/markets'
import { TRANSLATION_MAP, applyTemplateTranslation, ALL_APP_LANGUAGES } from '@/lib/template-translations'

const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || ''

/**
 * Resolve the correct tigoenergy.* site URL for a customer,
 * based on their most recent order's shipping country.
 * Falls back to tigoenergy.shop if no order/country is found.
 */
async function getSiteUrlForCustomer(supabase: any, customerId: string): Promise<string> {
    const { data: order } = await supabase
        .from('orders')
        .select('shipping_address')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const country = (order?.shipping_address as any)?.country?.toUpperCase()
    if (country) {
        const domain = getDomainForMarket(country)
        return `https://${domain}`
    }
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'
}

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
 * Deduct stock_quantity for all items in an order.
 * Sets stock_adjusted=true on the order to prevent double-deduction.
 * Also decrements reserved_quantity if it was previously incremented on confirm.
 */
export async function adjustStockForOrderAction(orderId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        // Fetch order with items — check guard flag
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('id, stock_adjusted, order_items(product_id, quantity)')
            .eq('id', orderId)
            .single()

        if (orderErr || !order) throw new Error('Order not found')
        if (order.stock_adjusted) {
            console.log(`Stock already adjusted for order ${orderId}, skipping`)
            return { success: true, skipped: true }
        }

        // Deduct stock for each item with a product_id
        for (const item of (order.order_items || [])) {
            if (!item.product_id || item.quantity <= 0) continue

            // Use RPC or manual decrement
            const { data: product } = await supabase
                .from('products')
                .select('stock_quantity, reserved_quantity')
                .eq('id', item.product_id)
                .single()

            if (!product) continue

            const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity)
            const newReserved = Math.max(0, (product.reserved_quantity || 0) - item.quantity)

            await supabase
                .from('products')
                .update({ stock_quantity: newStock, reserved_quantity: newReserved })
                .eq('id', item.product_id)
        }

        // Mark order as stock-adjusted
        await supabase
            .from('orders')
            .update({ stock_adjusted: true })
            .eq('id', orderId)

        console.log(`Stock adjusted for order ${orderId}: ${(order.order_items || []).length} items`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in adjustStockForOrderAction:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Increment reserved_quantity for all items in an order (called on order confirmation).
 */
export async function reserveStockForOrderAction(orderId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        const { data: order, error } = await supabase
            .from('orders')
            .select('id, order_items(product_id, quantity)')
            .eq('id', orderId)
            .single()

        if (error || !order) throw new Error('Order not found')

        for (const item of (order.order_items || [])) {
            if (!item.product_id || item.quantity <= 0) continue

            const { data: product } = await supabase
                .from('products')
                .select('reserved_quantity')
                .eq('id', item.product_id)
                .single()

            if (!product) continue

            await supabase
                .from('products')
                .update({ reserved_quantity: (product.reserved_quantity || 0) + item.quantity })
                .eq('id', item.product_id)
        }

        return { success: true }
    } catch (err: any) {
        console.error('Error in reserveStockForOrderAction:', err)
        return { success: false, error: err.message }
    }
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
            subject: 'Invitation to Initra Energija Admin Team',
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

        // 1. Create Auth User (phone + email pre-confirmed for admin-created accounts)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: password || randomBytes(16).toString('base64url'),
            email_confirm: true,
            phone_confirm: true,
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
                isDefaultShipping: false,
            })
        }

        // 3. Upsert Customer Profile (DB trigger may or may not create the row;
        //    upsert guarantees the row exists with all fields)
        const profilePayload: any = {
            id: authData.user.id,
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
        if (addresses.length > 0) profilePayload.addresses = addresses

        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, 400))
            const { error: profileError } = await supabase
                .from('customers')
                .upsert(profilePayload, { onConflict: 'id' })
            if (!profileError) break
            if (attempt === 2) console.warn('Profile upsert error:', profileError.message)
        }

        revalidatePath('/admin/customers')
        return { success: true, data: { userId: authData.user.id } }
    } catch (err: any) {
        console.error('Error in adminCreateCustomerAction:', err)
        return { success: false, error: err.message || 'Failed to create customer' }
    }
}

/**
 * Admin reactivates a deleted customer — recreates their auth account and sends password reset.
 */
export async function adminReactivateCustomerAction(customerId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        // Get customer data
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single()

        if (error || !customer) throw new Error('Customer not found')
        if (customer.account_status !== 'deleted') throw new Error('Customer is not deleted')

        // Create new auth user with the same ID
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: customer.email,
            password: randomBytes(16).toString('base64url'),
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
                first_name: customer.first_name,
                last_name: customer.last_name,
                phone: customer.phone,
                customer_type: customer.customer_type || 'b2c',
            }
        })

        if (authError) throw authError

        // Update customer row: set active, link to new auth user ID
        const newUserId = authData.user.id
        if (newUserId !== customerId) {
            // Auth created with a new ID — update the customers row
            await supabase.from('customers').update({
                id: newUserId,
                account_status: 'active',
                updated_at: new Date().toISOString(),
            }).eq('id', customerId)
        } else {
            await supabase.from('customers').update({
                account_status: 'active',
                updated_at: new Date().toISOString(),
            }).eq('id', customerId)
        }

        // Send password reset email so they can set their password
        try {
            await adminResetCustomerPasswordAction(customer.email)
        } catch (e) {
            console.warn('Failed to send reset email during reactivation:', e)
        }

        revalidatePath('/admin/customers')
        return { success: true }
    } catch (err: any) {
        console.error('Error in adminReactivateCustomerAction:', err)
        return { success: false, error: err.message || 'Failed to reactivate customer' }
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
            sl: 'Vaš B2B račun je potrjen — Initra Energija',
            de: 'Ihr B2B-Konto wurde verifiziert — Initra Energija',
            it: 'Il tuo account B2B è stato verificato — Initra Energija',
            fr: 'Votre compte B2B a été vérifié — Initra Energija',
        }
        const subject = subjectMap[locale] || 'Your B2B Account is Verified — Initra Energija'
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

        const deliveredAt = new Date().toISOString()
        const updateData: any = { status: 'delivered', delivered_at: deliveredAt }

        // For net orders: set payment_due_date starting from delivery
        // First fetch order to check payment_terms
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('payment_terms, payment_due_date, customer_id')
            .eq('id', orderId)
            .single()

        if (existingOrder?.payment_terms === 'net30' && !existingOrder.payment_due_date) {
            let days = 30
            if (existingOrder.customer_id) {
                const { data: customer } = await supabase
                    .from('customers')
                    .select('payment_terms_days')
                    .eq('id', existingOrder.customer_id)
                    .single()
                if (customer?.payment_terms_days) days = customer.payment_terms_days
            }
            const dueDate = new Date(deliveredAt)
            dueDate.setDate(dueDate.getDate() + days)
            updateData.payment_due_date = dueDate.toISOString().split('T')[0]
        }

        const { data: order, error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select('*, order_items(*)')
            .single()

        if (error || !order) throw new Error('Order not found')

        const locale = order.language || 'en'
        const customerName = (order.shipping_address as any)?.first_name || order.customer_email

        try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'
            const html = await renderTemplate('delivered', {
                name: customerName,
                order_number: String(order.order_number),
                order_url: `${siteUrl}/orders/${orderId}`,
                invoice_url: order.invoice_url ? `${siteUrl}${order.invoice_url}` : `${siteUrl}/orders/${orderId}`,
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

        // 1. Get all orders for this customer
        const { data: orders } = await supabase
            .from('orders')
            .select('id')
            .eq('customer_id', id)

        // 2. Delete order-related data
        if (orders && orders.length > 0) {
            const orderIds = orders.map(o => o.id)
            await supabase.from('order_items').delete().in('order_id', orderIds)
            await supabase.from('order_payments').delete().in('order_id', orderIds)
            await supabase.from('order_returns').delete().in('order_id', orderIds)
            await supabase.from('delivery_tokens').delete().in('order_id', orderIds)
            await supabase.from('orders').delete().eq('customer_id', id)
        }

        // 3. Delete from Supabase Auth
        const { error: authError } = await supabase.auth.admin.deleteUser(id)
        if (authError) {
            console.error('Error deleting auth user:', authError)
        }

        // 4. Delete from customers table
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

        let customerId: string | null = null

        if (isEmail) {
            // Email passed directly — look up customer ID for domain resolution
            emailToReset = identifier
            const { data: cust } = await supabase
                .from('customers')
                .select('id, preferred_language')
                .eq('email', identifier)
                .maybeSingle()
            if (cust) {
                customerId = cust.id
                locale = cust.preferred_language || 'en'
            }
        } else {
            // UUID passed — try customers table first, fall back to Supabase Auth
            customerId = identifier
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

        // Resolve the correct domain based on the customer's shipping country
        const siteUrl = customerId
            ? await getSiteUrlForCustomer(supabase, customerId)
            : (process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop')

        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: emailToReset,
            options: { redirectTo: `${siteUrl}/auth/reset-password` }
        })

        if (linkError) throw linkError
        // Build a direct link to our site using the hashed_token, bypassing
        // Supabase's /auth/v1/verify redirect which falls back to Site URL (localhost).
        const hashedToken = linkData.properties.hashed_token
        const resetLink = `${siteUrl}/auth/reset-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`

        const translations = await getEmailTranslations(locale)
        const subject = translations.email?.passwordReset?.title || 'Reset Your Password'
        const html = await renderTemplate('password-reset', { reset_link: resetLink }, locale)

        await sendEmail({
            to: emailToReset,
            subject,
            html,
            emailType: 'password_reset',
        })

        return { success: true, resetLink }
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
                const country = order.shipping_address.country?.toUpperCase()
                const setupDomain = getDomainForMarket(country || order.market || 'SHOP')
                const setupSiteUrl = `https://${setupDomain}`
                const { data: linkData } = await supabase.auth.admin.generateLink({
                    type: 'recovery',
                    email: customer.email,
                    options: { redirectTo: `${setupSiteUrl}/auth/reset-password` }
                });

                if (linkData?.properties?.hashed_token) {
                    // Build direct link using hashed_token, bypassing Supabase's redirect
                    const setupLink = `${setupSiteUrl}/auth/reset-password?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`

                    const setupLocale = order.language || 'en';
                    const welcomeHtml = await renderTemplate('admin-account-setup', {
                        name: `${customer.first_name} ${customer.last_name}`,
                        setup_link: setupLink
                    }, setupLocale);

                    const setupSubjectMap: Record<string, string> = {
                        sl: 'Aktivirajte svoj račun Initra Energija',
                        de: 'Aktivieren Sie Ihr Initra Energija-Konto',
                        it: 'Attiva il tuo account Initra Energija',
                        fr: 'Activez votre compte Initra Energija',
                    };
                    await sendEmail({
                        to: customer.email,
                        subject: setupSubjectMap[setupLocale] || 'Activate Your Initra Energija Account',
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
                payment_method: order.payment_method === 'NET30' ? 'IBAN' : (order.payment_method || 'IBAN'),
                payment_terms: order.payment_method === 'NET30' ? 'net30' : null,
                payment_due_date: order.payment_method === 'NET30'
                    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : null,
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
 * Issues an invoice for an existing order.
 * Set skipAdminCheck=true when called from warehouse automation (already validated).
 */
export async function issueOrderInvoiceAction(orderId: string, { skipAdminCheck = false } = {}) {
    try {
        if (!skipAdminCheck && !await checkIsAdmin()) throw new Error('Unauthorized');

        const supabase = skipAdminCheck ? await createAdminClient() : await createClient();

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
                invoice_url: `/api/orders/${orderId}/invoice?download=1`,
                status: 'completed'
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
 * Send invoice email to customer with PDF attached
 */
export async function adminSendInvoiceEmailAction(orderId: string, { skipAdminCheck = false } = {}) {
    try {
        if (!skipAdminCheck && !await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()
        const { data: order, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', orderId)
            .single()

        if (error || !order) throw new Error('Order not found')
        if (!order.invoice_number) throw new Error('Invoice not issued yet')

        const locale = order.language || 'en'

        // Generate PDF directly using shared libs
        const { generateInvoicePdf } = await import('@/lib/invoice-pdf')
        const pdfBuffer = await generateInvoicePdf(order, supabase)
        const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

        const customerName = (order.billing_address as any)?.first_name
            || (order.shipping_address as any)?.first_name
            || order.customer_email

        const subjectMap: Record<string, string> = {
            sl: `Račun ${order.invoice_number} — Naročilo #${order.order_number}`,
            hr: `Račun ${order.invoice_number} — Narudžba #${order.order_number}`,
            de: `Rechnung ${order.invoice_number} — Bestellung #${order.order_number}`,
        }
        const subject = subjectMap[locale] || `Invoice ${order.invoice_number} — Order #${order.order_number}`

        const greetingMap: Record<string, string> = {
            sl: 'Pozdravljeni', hr: 'Poštovani', de: 'Sehr geehrte/r',
        }
        const greeting = greetingMap[locale] || 'Dear'

        const bodyMap: Record<string, string> = {
            sl: `V priponki vam pošiljamo račun <strong>${order.invoice_number}</strong> za naročilo <strong>#${order.order_number}</strong>.`,
            hr: `U prilogu vam šaljemo račun <strong>${order.invoice_number}</strong> za narudžbu <strong>#${order.order_number}</strong>.`,
            de: `Anbei erhalten Sie die Rechnung <strong>${order.invoice_number}</strong> für Bestellung <strong>#${order.order_number}</strong>.`,
        }
        const bodyText = bodyMap[locale] || `Please find attached your invoice <strong>${order.invoice_number}</strong> for order <strong>#${order.order_number}</strong>.`

        const regardsMap: Record<string, string> = {
            sl: 'S spoštovanjem', hr: 'S poštovanjem', de: 'Mit freundlichen Grüßen',
        }
        const regards = regardsMap[locale] || 'Best regards'

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:'Inter',-apple-system,sans-serif;background:#f9fafb;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
    <div style="background:#7c3aed;padding:5px 0;text-align:center;">
        <img src="https://tigoenergy.shop/initra-logo.png" alt="Initra Energija" style="height:20px;width:auto;display:block;margin:0 auto;">
    </div>
    <div style="padding:40px 30px;">
        <div style="text-align:center;font-size:48px;margin-bottom:20px;">📄</div>
        <p>${greeting} ${customerName},</p>
        <p>${bodyText}</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:16px 20px;margin:24px 0;">
            <p style="margin:0;font-size:14px;color:#374151;"><strong>${order.invoice_number}</strong></p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${order.order_number} &bull; ${new Date(order.invoice_created_at).toLocaleDateString(locale === 'sl' ? 'sl-SI' : locale === 'de' ? 'de-DE' : locale === 'hr' ? 'hr-HR' : 'en-GB')}</p>
        </div>
        <p style="font-size:13px;color:#6b7280;">${regards},<br><strong>Initra Energija d.o.o.</strong></p>
    </div>
    <div style="background:#f3f4f6;padding:20px 30px;text-align:center;font-size:12px;color:#6b7280;">
        <p style="margin:0;"><a href="mailto:support@tigoenergy.shop" style="color:#7c3aed;text-decoration:none;">support@tigoenergy.shop</a> | <a href="https://tigoenergy.shop" style="color:#7c3aed;text-decoration:none;">tigoenergy.shop</a></p>
    </div>
</div></body></html>`

        await sendEmail({
            to: order.customer_email,
            subject,
            html,
            skipUnsubscribe: true,
            orderId,
            emailType: 'invoice_sent',
            attachments: [{
                type: 'application/pdf',
                name: `${order.invoice_number}.pdf`,
                content: pdfBase64,
            }],
        })

        revalidatePath(`/admin/orders/${orderId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in adminSendInvoiceEmailAction:', err)
        return { success: false, error: err.message || 'Failed to send invoice email' }
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
        // If Net30, also set payment terms on the order
        if (paymentMethod === 'net30') {
            updates.payment_method = 'IBAN'
            updates.payment_terms = 'net30'
            updates.payment_due_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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
 * Update shipping address on an existing order
 */
export async function adminUpdateOrderShippingAddressAction(orderId: string, shippingAddress: any) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        const supabase = await createAdminClient()
        const { error } = await supabase
            .from('orders')
            .update({ shipping_address: shippingAddress })
            .eq('id', orderId)
        if (error) throw error
        revalidatePath(`/admin/orders/${orderId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error updating shipping address:', err)
        return { success: false, error: err.message || 'Failed to update shipping address' }
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

                // Also match SI00 payment reference format (SI00 XXXXXX — last 6 digits)
                const orderTimestamp = order.order_number.replace('ETRG-ORD-', '')
                const si00Normalized = `SI00${orderTimestamp.slice(-6)}`

                // Check if order number or SI00 reference appears in reference or description
                const refHasOrderNum = refNormalized.includes(orderNumNormalized) || descNormalized.includes(orderNumNormalized)
                    || refNormalized.includes(si00Normalized) || descNormalized.includes(si00Normalized)
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

/**
 * Admin sends a delivery link to the driver for digital dobavnica + signature capture
 */
export async function adminSendDeliveryToDriverAction(orderId: string, driverEmail: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        // Fetch order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('order_number, customer_email, company_name, shipping_address')
            .eq('id', orderId)
            .single()

        if (orderError || !order) throw new Error('Order not found')

        // Generate secure token
        const token = randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

        // Get admin email
        const cookieStore = await cookies()
        const adminSupabase = await createClient()
        const { data: { user } } = await adminSupabase.auth.getUser()

        // Insert token
        const { error: insertError } = await supabase
            .from('delivery_tokens')
            .insert({
                order_id: orderId,
                token,
                driver_email: driverEmail,
                expires_at: expiresAt,
                created_by: user?.email || 'admin',
            })

        if (insertError) throw insertError

        // Send email to driver
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'
        const customerName = order.shipping_address
            ? `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim()
            : order.customer_email
        const shippingAddr = order.shipping_address
            ? `${order.shipping_address.street || ''}, ${order.shipping_address.postal_code || ''} ${order.shipping_address.city || ''}`
            : 'N/A'

        const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#f9fafb;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#1a2b3c;padding:24px 32px;color:#fff;">
    <img src="${siteUrl}/initra-logo.png" alt="Tigo" style="height:24px;margin-bottom:8px;">
    <h1 style="font-size:20px;font-weight:300;margin:0;">Delivery Assignment</h1>
  </div>
  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:14px;">You have a new delivery to complete:</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Order</p>
      <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111;">#${order.order_number}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Deliver to</p>
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#111;">${customerName}${order.company_name ? ` (${order.company_name})` : ''}</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">${shippingAddr}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;">Open the driver portal to view the delivery note and collect the customer's signature:</p>
    <a href="${siteUrl}/driver" style="display:block;text-align:center;background:#16a34a;color:#fff;padding:14px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin:16px 0;">Open Driver Portal</a>
    <p style="color:#9ca3af;font-size:11px;text-align:center;">This delivery link expires in 7 days.</p>
  </div>
</div></body></html>`

        await sendEmail({
            to: driverEmail,
            subject: `Delivery Assignment: #${order.order_number}`,
            html,
            orderId,
            emailType: 'driver_delivery_assignment',
        })

        // Deduct stock when dobavnica is issued (goods leaving warehouse)
        await adjustStockForOrderAction(orderId)

        revalidatePath(`/admin/orders/${orderId}`)
        return { success: true, token }
    } catch (err: any) {
        console.error('Error in adminSendDeliveryToDriverAction:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Send packing slip and shipping label to warehouse worker via email
 */
export async function adminSendToWarehouseAction(orderId: string, warehouseEmail: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        // Look up warehouse worker name
        const supabase = await createAdminClient()
        const { data: driver } = await supabase
            .from('drivers')
            .select('name')
            .eq('email', warehouseEmail)
            .single()

        const { sendWarehouseEmail } = await import('@/lib/warehouse')
        const result = await sendWarehouseEmail(orderId, warehouseEmail, driver?.name || warehouseEmail.split('@')[0])

        revalidatePath(`/admin/orders/${orderId}`)
        return result
    } catch (err: any) {
        console.error('Error in adminSendToWarehouseAction:', err)
        return { success: false, error: err.message }
    }
}

export async function adminDeleteOrderAction(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const cookieStore = await cookies()
        if (cookieStore.get('tigo-admin')?.value !== '1') {
            return { success: false, error: 'Unauthorized' }
        }
        const supabase = await createAdminClient()

        // Cascade delete child records
        await supabase.from('order_items').delete().eq('order_id', orderId)
        await supabase.from('order_payments').delete().eq('order_id', orderId)
        await supabase.from('order_returns').delete().eq('order_id', orderId)
        await supabase.from('delivery_tokens').delete().eq('order_id', orderId)
        await supabase.from('email_logs').delete().eq('order_id', orderId)

        const { error } = await supabase.from('orders').delete().eq('id', orderId)
        if (error) throw error

        revalidatePath('/admin/orders')
        return { success: true }
    } catch (err: any) {
        console.error('Error in adminDeleteOrderAction:', err)
        return { success: false, error: err.message }
    }
}
