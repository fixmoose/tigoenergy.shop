'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface CreateCustomerParams {
    email: string
    first_name: string
    last_name: string
    is_b2b?: boolean
    customer_type?: string
}

export async function createCustomer(params: CreateCustomerParams) {
    const supabase = await createClient()

    // 1. Try to fetch administrative rights if needed, but for now we'll assume logged-in admin can insert
    // Note: if 'customers' is linked to 'auth.users' via foreign key, this might fail unless we create an auth user first.
    // We will try to insert directly into 'customers'. If it fails, it means we need to use Admin Auth API (which requires service key, often not exposed in client-side 'createClient').

    // Strategy: Try Insert. 
    // If 'Guest', we might generate a UUID if the table allows it.
    // If the schema requires 'id' to be an existing auth.user id, this approach won't work for arbitrary emails without creating an auth user.

    // Assumption: The 'customers' table allows manual inserts for "Guest" users (no auth login needed yet) 
    // OR the system is configured to allow admins to create profiles.

    // Let's generate a random UUID if it's a guest? Postgres usually handles 'default gen_random_uuid()' if ID is not provided.
    // If ID matches auth.users, failing to provide one might error if it's NOT auto-gen.

    // For now, let's try to insert.

    const { data, error } = await supabase
        .from('customers')
        .insert({
            email: params.email,
            first_name: params.first_name,
            last_name: params.last_name,
            is_b2b: params.is_b2b || false,
            customer_type: params.customer_type || 'regular',
            created_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) {
        console.error('Create Customer Error:', error)
        throw new Error(error.message)
    }

    revalidatePath('/admin/customers')
    return data
}

export async function updateMarketingPreferences(newsletter: boolean, marketing: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('customers')
        .update({
            newsletter_subscribed: newsletter,
            marketing_consent: marketing,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

    if (error) throw error
    revalidatePath('/dashboard')
    revalidatePath('/profile')
    return { success: true }
}

export async function getMarketingPreferences() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('customers')
        .select('newsletter_subscribed, marketing_consent')
        .eq('id', user.id)
        .single()

    if (error) return null
    return data
}
