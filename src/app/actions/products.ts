'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProductStatus(id: string, active: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('products')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) {
        throw new Error('Failed to update product status: ' + error.message)
    }

    revalidatePath('/admin/products')
    revalidatePath('/products') // Update public store too
}

export async function updateProductFeatured(id: string, featured: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('products')
        .update({ featured, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) {
        throw new Error('Failed to update product featured status: ' + error.message)
    }

    revalidatePath('/admin/products')
    revalidatePath('/products')
}


export async function searchProductsAction(query: string) {
    const supabase = await createClient()
    
    const { data, error } = await supabase
        .from('products')
        .select('id, name_en, sku, price_eur, b2b_price_eur, weight_kg, active')
        .or(`name_en.ilike.%${query}%,sku.ilike.%${query}%`)
        .eq('active', true)
        .limit(20)

    if (error) throw error
    return data
}
