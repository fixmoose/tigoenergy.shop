'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export async function updateProductStatus(id: string, active: boolean) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('products')
            .update({ active, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error

        revalidatePath('/admin/products')
        revalidatePath('/products')
        return { success: true }
    } catch (err: any) {
        console.error('Error in updateProductStatus:', err)
        return { success: false, error: err.message || 'Failed to update product status' }
    }
}

export async function updateProductFeatured(id: string, featured: boolean) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('products')
            .update({ featured, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error

        revalidatePath('/admin/products')
        revalidatePath('/products')
        return { success: true }
    } catch (err: any) {
        console.error('Error in updateProductFeatured:', err)
        return { success: false, error: err.message || 'Failed to update product featured status' }
    }
}


/**
 * Get ordered quantities per product from active orders.
 * Active = pending, processing, shipped (not cancelled, not delivered).
 * Returns: { [product_id]: number }
 */
export async function getOrderedQuantities(): Promise<{ success: boolean; data?: Record<string, number>; error?: string }> {
    try {
        const cookieStore = await cookies()
        if (cookieStore.get('tigo-admin')?.value !== '1') {
            return { success: false, error: 'Unauthorized' }
        }

        const supabase = await createAdminClient()

        // Fetch all order_items for active orders (pending, processing, shipped)
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id')
            .in('status', ['pending', 'processing', 'shipped'])

        if (ordersError) throw ordersError
        if (!orders || orders.length === 0) return { success: true, data: {} }

        const orderIds = orders.map(o => o.id)

        // Fetch items in batches if needed (Supabase .in() limit)
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('product_id, quantity')
            .in('order_id', orderIds)
            .not('product_id', 'is', null)

        if (itemsError) throw itemsError

        const quantities: Record<string, number> = {}
        for (const item of items || []) {
            if (item.product_id && item.quantity > 0) {
                quantities[item.product_id] = (quantities[item.product_id] || 0) + item.quantity
            }
        }

        return { success: true, data: quantities }
    } catch (err: any) {
        console.error('Error in getOrderedQuantities:', err)
        return { success: false, error: err.message || 'Failed to get ordered quantities' }
    }
}

export async function searchProductsAction(query: string) {
    try {
        const supabase = await createClient()
        let q = supabase
            .from('products')
            .select('id, name_en, sku, price_eur, b2b_price_eur, weight_kg, active, stock_quantity')
            .eq('active', true)
            .order('name_en', { ascending: true })
            .limit(200)

        if (query.trim()) {
            q = q.or(`name_en.ilike.%${query}%,sku.ilike.%${query}%`)
        }

        const { data, error } = await q
        if (error) throw error
        return { success: true, data }
    } catch (err: any) {
        console.error('Error in searchProductsAction:', err)
        return { success: false, error: err.message || 'Failed to search products' }
    }
}
