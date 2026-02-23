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

export async function cleanupMockStockAction() {
    const supabase = await createClient()

    // 1. Fetch products that have potential mock stock (100 or 50)
    const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, stock_quantity, supplier_invoices')
        .in('stock_quantity', [50, 100])

    if (fetchError) {
        throw new Error('Failed to fetch products for cleanup: ' + fetchError.message)
    }

    if (!products || products.length === 0) {
        return { count: 0 }
    }

    // 2. Filter products that have NO supplier invoices (real stock has invoices)
    const mockProductIds = products
        .filter((p: any) => !p.supplier_invoices || (p.supplier_invoices as any[]).length === 0)
        .map((p: any) => p.id)

    if (mockProductIds.length === 0) {
        return { count: 0 }
    }

    // 3. Reset stock_quantity to 0 for these products
    const { error: updateError } = await supabase
        .from('products')
        .update({ stock_quantity: 0, updated_at: new Date().toISOString() })
        .in('id', mockProductIds)

    if (updateError) {
        throw new Error('Failed to reset mock stock: ' + updateError.message)
    }

    revalidatePath('/admin/products')
    return { count: mockProductIds.length }
}
