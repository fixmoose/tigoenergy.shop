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
 * Admin action: Update shipping cost on an order.
 */
export async function adminUpdateShippingCost(
  orderId: string,
  shippingCost: number
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('tigo-admin')?.value !== '1') {
    return { success: false, error: 'Not authorized' }
  }

  const supabase = await createAdminClient()

  // Get current order for recalc
  const { data: order } = await supabase
    .from('orders')
    .select('subtotal, vat_rate, vat_id, transaction_type')
    .eq('id', orderId)
    .single()

  if (!order) return { success: false, error: 'Order not found' }

  const subtotal = order.subtotal || 0
  const vatRate = order.vat_rate || 0
  // B2B EU = reverse charge, no VAT
  const isReverseCharge = !!(order.vat_id && order.transaction_type === 'eu')
  const vatAmount = isReverseCharge ? 0 : subtotal * vatRate
  const total = subtotal + shippingCost + vatAmount

  const { error } = await supabase
    .from('orders')
    .update({ shipping_cost: shippingCost, vat_amount: vatAmount, total })
    .eq('id', orderId)

  if (error) return { success: false, error: error.message }

  return { success: true }
}

/**
 * Returns true if the order is still "holding" reserved stock — i.e. it was
 * confirmed and its stock hasn't been fully adjusted yet. While true,
 * adding/removing line items must mirror products.reserved_quantity so the
 * counter doesn't drift on SKU swaps or qty edits.
 */
async function isOrderInReservationState(supabase: any, orderId: string): Promise<boolean> {
  const { data: o } = await supabase
    .from('orders')
    .select('status, stock_adjusted')
    .eq('id', orderId)
    .single()
  if (!o) return false
  if (o.stock_adjusted) return false
  return ['processing', 'shipped'].includes(o.status)
}

async function adjustProductReserved(supabase: any, productId: string, delta: number) {
  const { data: p } = await supabase
    .from('products')
    .select('reserved_quantity')
    .eq('id', productId)
    .single()
  if (!p) return
  const next = Math.max(0, (p.reserved_quantity || 0) + delta)
  await supabase
    .from('products')
    .update({ reserved_quantity: next })
    .eq('id', productId)
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
    .select('vat_rate, shipping_cost, vat_id, transaction_type')
    .eq('id', orderId)
    .single()

  const vatRate = order?.vat_rate || 0
  const shippingCost = order?.shipping_cost || 0
  // B2B EU = reverse charge, no VAT
  const isReverseCharge = !!(order?.vat_id && order?.transaction_type === 'eu')
  const vatAmount = isReverseCharge ? 0 : subtotal * vatRate
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

  // Mirror reservation by the qty delta when the order is still holding stock.
  const qtyDelta = qty - item.quantity
  if (qtyDelta !== 0 && item.product_id && await isOrderInReservationState(supabase, orderId)) {
    await adjustProductReserved(supabase, item.product_id, qtyDelta)
  }

  await recalcOrderTotals(supabase, orderId)
  return { success: true }
}

/**
 * Admin action: Remove an order item.
 *
 * If the order is still holding reserved stock (confirmed and not yet
 * adjusted), decrement that product's reserved_quantity by the removed
 * line's qty so swaps via remove-then-add don't leave phantom reservations.
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

  // Snapshot the row before delete so we can release the reservation
  const { data: existing } = await supabase
    .from('order_items')
    .select('id, product_id, quantity')
    .eq('id', itemId)
    .eq('order_id', orderId)
    .single()

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId)
    .eq('order_id', orderId)

  if (error) return { success: false, error: error.message }

  if (existing?.product_id && existing.quantity > 0 && await isOrderInReservationState(supabase, orderId)) {
    await adjustProductReserved(supabase, existing.product_id, -existing.quantity)
  }

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

  // Compliance fields (applies_trod_fee, packaging_*, etc.) are auto-filled
  // by the populate_order_item_compliance BEFORE INSERT trigger from
  // product_id, so we only need the basic line-item data here.
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, name_en, sku, weight_kg, cn_code')
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
    })

  if (error) return { success: false, error: error.message }

  // Mirror the reservation if the order is still holding stock.
  if (quantity > 0 && await isOrderInReservationState(supabase, orderId)) {
    await adjustProductReserved(supabase, product.id, +quantity)
  }

  await recalcOrderTotals(supabase, orderId)
  return { success: true }
}
