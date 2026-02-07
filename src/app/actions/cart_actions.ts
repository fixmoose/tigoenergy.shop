'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Use types from database.ts once updated, or define locally if needed contextually
// But best to use shared types. I'll assume they will be added.

export async function getSavedCarts(userId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('saved_carts')
        .select('*, items:saved_cart_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching saved carts:', error)
        return []
    }
    return data
}

export async function saveCurrentCart(userId: string, name: string, items: any[]) {
    // items should match the structure we want to save
    const supabase = await createClient()

    // 1. Create Saved Cart
    const { data: cartData, error: cartError } = await supabase
        .from('saved_carts')
        .insert({ user_id: userId, name })
        .select()
        .single()

    if (cartError || !cartData) {
        throw new Error('Failed to create saved cart: ' + cartError?.message)
    }

    const savedCartId = cartData.id

    // 2. Insert Items
    if (items.length > 0) {
        const payload = items.map(item => ({
            saved_cart_id: savedCartId,
            product_id: item.product_id, // Ensure this exists on item
            quantity: item.quantity,
            sku: item.sku,
            name: item.name,
            unit_price: item.unit_price || item.price || 0,
            image_url: item.image_url
        }))

        const { error: itemsError } = await supabase
            .from('saved_cart_items')
            .insert(payload)

        if (itemsError) {
            // Cleanup if items fail? Or just throw.
            console.error("Failed to save items", itemsError)
            throw new Error('Failed to save items.')
        }
    }

    revalidatePath('/cart')
    return { success: true, id: savedCartId }
}

export async function deleteSavedCart(cartId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('saved_carts').delete().eq('id', cartId)

    if (error) throw error
    revalidatePath('/cart')
}

export async function loadSavedCart(savedCartId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("You must be logged in to load a saved cart")
    }

    // 1. Fetch Saved Items
    const { data: savedItems, error: savedError } = await supabase
        .from('saved_cart_items')
        .select('*')
        .eq('saved_cart_id', savedCartId)

    if (savedError || !savedItems) {
        throw new Error("Failed to fetch saved cart items")
    }

    // 2. Map to CartItem format
    // Note: We trust the saved snapshot data (price, etc.) or should we refetch?
    // User expectation for "Saved Cart" is usually restoring the state. 
    // However, prices might change. For a B2B PO, maybe they expect the price at that time?
    // But for a dynamic shop, prices should be current.
    // Let's use the saved data effectively, but ideally we would check live prices. 
    // For now, simple restoration.
    const newItems = (savedItems as any[]).map((item: any) => ({
        product_id: item.product_id,
        sku: item.sku || '',
        name: item.name || 'Unknown Product',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        image_url: item.image_url || undefined,
        total_price: (item.unit_price || 0) * item.quantity
    }))

    // 3. Overwrite Active Cart
    // Find User Cart
    const { data: existingCart } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', user.id)
        .single() // Might be null

    if (existingCart) {
        const { error } = await supabase
            .from('carts')
            .update({ items: newItems, updated_at: new Date().toISOString() })
            .eq('id', existingCart.id)

        if (error) throw new Error("Failed to update active cart")
    } else {
        const { error } = await supabase
            .from('carts')
            .insert({ user_id: user.id, items: newItems })

        if (error) throw new Error("Failed to create active cart")
    }

    revalidatePath('/cart')
    return { success: true }
}
