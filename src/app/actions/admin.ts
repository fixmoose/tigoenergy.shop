'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate } from '@/lib/email'

const MASTER_ADMIN_EMAIL = 'dejan@haywilson.com'

/**
 * Checks if the current user is an admin
 */
async function checkIsAdmin() {
    const supabase = await createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.user_metadata?.role === 'admin'
}

/**
 * Checks if the current user is the Master Admin
 */
async function checkIsMasterAdmin() {
    const supabase = await createAdminClient()
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

    revalidatePath(`/admin/customers/${id}`)
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
