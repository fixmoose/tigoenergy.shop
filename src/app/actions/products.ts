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
