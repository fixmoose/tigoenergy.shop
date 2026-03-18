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

/**
 * Recalculate order totals from items and update the order row.
 */
async function recalcOrderTotals(supabase: any, orderId: string) {
  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, unit_price, total_price')
    .eq('order_id', orderId)

  const subtotal = (items || []).reduce((sum: number, i: any) => sum + (i.total_price || 0), 0)

  const { data: order } = await supabase
    .from('orders')
    .select('vat_rate, shipping_cost')
    .eq('id', orderId)
    .single()

  const vatRate = order?.vat_rate || 0
  const shippingCost = order?.shipping_cost || 0
  const vatAmount = subtotal * (vatRate / 100)
  const total = subtotal + shippingCost + vatAmount

  await supabase
    .from('orders')
    .update({ subtotal, vat_amount: vatAmount, total })
    .eq('id', orderId)
}

/**
 * Admin action: Update an order item's quantity and/or unit price.
 */
export async function adminUpdateOrderItem(
  itemId: string,
  orderId: string,
  updates: { quantity?: number; unit_price?: number }
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('tigo-admin')?.value !== '1') {
    return { success: false, error: 'Not authorized' }
  }

  const supabase = await createAdminClient()

  // Get current item
  const { data: item, error: fetchErr } = await supabase
    .from('order_items')
    .select('*')
    .eq('id', itemId)
    .eq('order_id', orderId)
    .single()

  if (fetchErr || !item) return { success: false, error: 'Item not found' }

  const qty = updates.quantity ?? item.quantity
  const price = updates.unit_price ?? item.unit_price
  const totalPrice = qty * price

  const { error } = await supabase
    .from('order_items')
    .update({ quantity: qty, unit_price: price, total_price: totalPrice })
    .eq('id', itemId)

  if (error) return { success: false, error: error.message }

  await recalcOrderTotals(supabase, orderId)
  return { success: true }
}

/**
 * Admin action: Remove an order item.
 */
export async function adminRemoveOrderItem(
  itemId: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('tigo-admin')?.value !== '1') {
    return { success: false, error: 'Not authorized' }
  }

  const supabase = await createAdminClient()

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId)
    .eq('order_id', orderId)

  if (error) return { success: false, error: error.message }

  await recalcOrderTotals(supabase, orderId)
  return { success: true }
}

/**
 * Admin action: Add a product to an existing order.
 */
export async function adminAddOrderItem(
  orderId: string,
  productId: string,
  quantity: number,
  unitPrice: number
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('tigo-admin')?.value !== '1') {
    return { success: false, error: 'Not authorized' }
  }

  const supabase = await createAdminClient()

  // Fetch product details
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, name_en, sku, weight_kg, cn_code, applies_trod_fee, trod_category_code, applies_packaging_fee, packaging_weight_kg, packaging_type, packaging_data')
    .eq('id', productId)
    .single()

  if (prodErr || !product) return { success: false, error: 'Product not found' }

  const totalPrice = quantity * unitPrice

  const { error } = await supabase
    .from('order_items')
    .insert({
      order_id: orderId,
      product_id: product.id,
      sku: product.sku,
      product_name: product.name_en,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      weight_kg: product.weight_kg,
      cn_code: product.cn_code,
      applies_trod_fee: product.applies_trod_fee,
      trod_category_code: product.trod_category_code,
      applies_packaging_fee: product.applies_packaging_fee,
      packaging_weight_kg: product.packaging_weight_kg,
      packaging_type: product.packaging_type,
      packaging_data: product.packaging_data,
    })

  if (error) return { success: false, error: error.message }

  await recalcOrderTotals(supabase, orderId)
  return { success: true }
}
