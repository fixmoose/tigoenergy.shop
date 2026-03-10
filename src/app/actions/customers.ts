'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

interface CreateCustomerParams {
    email: string
    first_name: string
    last_name: string
    is_b2b?: boolean
    customer_type?: string
}

export async function createCustomer(params: CreateCustomerParams) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.user_metadata?.role !== 'admin') throw new Error('Unauthorized')

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

        if (error) throw error

        revalidatePath('/admin/customers')
        return { success: true, data }
    } catch (err: any) {
        console.error('Error in createCustomer:', err)
        return { success: false, error: err.message || 'Failed to create customer' }
    }
}

export async function updateMarketingPreferences(newsletter: boolean, marketing: boolean) {
    try {
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
    } catch (err: any) {
        console.error('Error in updateMarketingPreferences:', err)
        return { success: false, error: err.message || 'Failed to update marketing preferences' }
    }
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

export async function getB2BCustomers() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.user_metadata?.role !== 'admin') throw new Error('Unauthorized')

        const { data, error } = await supabase
            .from('customers')
            .select('id, company_name, email')
            .eq('is_b2b', true)
            .order('company_name', { ascending: true })

        if (error) throw error
        return { success: true, data: data || [] }
    } catch (err: any) {
        console.error('Error in getB2BCustomers:', err)
        return { success: false, error: err.message || 'Failed to fetch B2B customers' }
    }
}

export async function searchCustomersAction(query: string) {
    try {
        const cookieStore = await cookies()
        if (cookieStore.get('tigo-admin')?.value !== '1') throw new Error('Unauthorized')

        const supabase = await createAdminClient()
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,company_name.ilike.%${query}%`)
            .limit(20)

        if (error) throw error
        return { success: true, data: data || [] }
    } catch (err: any) {
        console.error('Error in searchCustomersAction:', err)
        return { success: false, error: err.message || 'Failed to search customers' }
    }
}

export async function getCustomerLatestOrderAction(customerId: string) {
    try {
        const cookieStore = await cookies()
        if (cookieStore.get('tigo-admin')?.value !== '1') throw new Error('Unauthorized')

        const supabase = await createAdminClient()
        const { data } = await supabase
            .from('orders')
            .select('shipping_address, billing_address')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        return { success: true, data }
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to fetch order address' }
    }
}
