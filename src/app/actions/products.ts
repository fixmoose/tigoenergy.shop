'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
