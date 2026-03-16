'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Customer action: Convert a pending order back to cart for modification.
 * Cancels the original order with a note, and loads items into the cart.
 * Returns the order items so the client can add them to cart.
 */
export async function modifyOrder(orderId: string): Promise<{ success: boolean; error?: string; items?: any[]; originalOrderNumber?: string }> {
  const supabase = await createClient()

  // 1. Verify the user owns this order
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // 2. Fetch the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) return { success: false, error: 'Order not found' }
  if (order.customer_id !== user.id) return { success: false, error: 'Not authorized' }

  // 3. Check if modification is allowed
  const isPending = order.status === 'pending' && !order.confirmed_at
  const isUnlocked = order.modification_unlocked === true

  if (!isPending && !isUnlocked) {
    return { success: false, error: 'This order cannot be modified. It has already been confirmed.' }
  }

  // 4. Fetch order items
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*, products(images)')
    .eq('order_id', orderId)

  if (itemsError || !items) return { success: false, error: 'Failed to load order items' }

  // 5. Cancel the original order with a modification note
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      internal_notes: [order.internal_notes, `[${new Date().toISOString()}] Order cancelled for modification by customer. Items converted to cart.`].filter(Boolean).join('\n')
    })
    .eq('id', orderId)

  if (updateError) return { success: false, error: 'Failed to modify order' }

  // 6. Return items for the client to add to cart
  const cartItems = items.map((item: any) => ({
    product_id: item.product_id,
    sku: item.sku,
    name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    image_url: item.products?.images?.[0] || undefined,
    weight_kg: item.weight_kg,
  }))

  return {
    success: true,
    items: cartItems,
    originalOrderNumber: order.order_number
  }
}

/**
 * Admin action: Unlock a confirmed order so the customer can modify it.
 */
export async function adminUnlockOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  // Check admin
  const cookieStore = await cookies()
  if (cookieStore.get('tigo-admin')?.value !== '1') {
    return { success: false, error: 'Not authorized' }
  }

  const supabase = await createAdminClient()

  const { error } = await supabase
    .from('orders')
    .update({
      modification_unlocked: true,
      modification_unlocked_at: new Date().toISOString()
    })
    .eq('id', orderId)

  if (error) return { success: false, error: error.message }

  return { success: true }
}
