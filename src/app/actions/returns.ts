'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function requestReturn(data: {
    orderId: string
    customerId: string
    reason: 'found_cheaper' | 'damaged' | 'not_as_described' | 'changed_mind' | 'other'
    items: {
        product_id: string
        sku: string
        product_name: string
        quantity: number
        unit_price: number
    }[]
    images?: string[]
    customerNotes?: string
}) {
    const supabase = await createClient()

    // 1. Verify user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== data.customerId) {
        return { error: 'Unauthorized' }
    }

    // 2. Insert return request
    const { data: returnData, error } = await supabase
        .from('order_returns')
        .insert({
            order_id: data.orderId,
            customer_id: data.customerId,
            reason: data.reason,
            items: data.items,
            images: data.images || [],
            customer_notes: data.customerNotes || '',
            status: 'requested'
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating return request:', error)
        return { error: 'Failed to submit return request. Please try again.' }
    }

    // 3. Update order status if necessary? 
    // Usually, we keep the order as 'delivered' but show an active return.

    revalidatePath(`/orders/${data.orderId}`)
    revalidatePath('/dashboard')

    return { success: true, data: returnData }
}
