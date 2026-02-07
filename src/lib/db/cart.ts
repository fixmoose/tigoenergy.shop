import { createClient } from '@/lib/supabase/server'
import type { Cart, CartItem } from '@/types/database'

type CartLookup = { userId?: string; cartId?: string }

/**
 * Get a cart either by userId or cartId
 */
export async function getCart({ userId, cartId }: CartLookup): Promise<Cart | null> {
  const supabase = await createClient()
  let query = supabase.from('carts').select('*')

  if (cartId) query = query.eq('id', cartId)
  else if (userId) query = query.eq('user_id', userId)
  else throw new Error('userId or cartId required')

  const { data, error } = await query.limit(1).single()

  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }

  return data ?? null
}

/**
 * Create a new cart, optionally linked to a user
 */
export async function createCart({ userId, items = [] }: { userId?: string; items?: CartItem[] } = {}): Promise<Cart> {
  const supabase = await createClient()
  const newCart: Partial<Cart> = { user_id: userId, items }
  const { data, error } = await supabase.from('carts').insert(newCart).select().single()
  if (error) throw error
  return data as Cart
}

/**
 * Add an item to a cart (by userId or cartId). Creates a cart when none exists.
 */
export async function addToCart(lookup: CartLookup, item: CartItem): Promise<Cart> {
  const supabase = await createClient()
  const { userId, cartId } = lookup

  // Find existing cart by cartId or userId
  let existing: Cart | null = null
  if (cartId) existing = await getCart({ cartId })
  else if (userId) existing = await getCart({ userId })

  if (!existing) {
    const newCart = await createCart({ userId, items: [{ ...item, total_price: item.total_price ?? item.unit_price * item.quantity }] })
    return newCart
  }

  const items = existing.items ?? []
  const idx = items.findIndex((i) => i.product_id === item.product_id || i.sku === item.sku)

  if (idx === -1) {
    items.push({ ...item, total_price: (item.total_price ?? (item.unit_price * item.quantity)) })
  } else {
    const existingItem = items[idx]
    const newQuantity = (existingItem.quantity || 0) + item.quantity
    // Use the unit price of the NEW item being added (it might be a discounted one)
    items[idx] = { ...existingItem, quantity: newQuantity, unit_price: item.unit_price, total_price: item.unit_price * newQuantity }
  }

  const { data, error } = await supabase.from('carts').update({ items }).eq('id', existing.id).select().single()
  if (error) throw error
  return data as Cart
}

/**
 * Update a cart item (by product_id or sku). Accepts userId or cartId
 */
export async function updateCartItem({ userId, cartId }: CartLookup, productIdOrSku: string, updates: Partial<CartItem>): Promise<Cart> {
  const supabase = await createClient()
  const cart = await getCart({ userId, cartId })
  if (!cart) throw new Error('Cart not found')

  const items = cart.items ?? []
  const idx = items.findIndex((i) => i.product_id === productIdOrSku || i.sku === productIdOrSku)
  if (idx === -1) throw new Error('Cart item not found')

  const updatedItem = { ...items[idx], ...updates }
  if (updates.quantity !== undefined) {
    updatedItem.total_price = (updates.unit_price ?? items[idx].unit_price) * updates.quantity
  } else if (updates.unit_price !== undefined) {
    updatedItem.total_price = updates.unit_price * updatedItem.quantity
  }

  items[idx] = updatedItem

  const { data, error } = await supabase.from('carts').update({ items }).eq('id', cart.id).select().single()
  if (error) throw error
  return data as Cart
}

/**
 * Remove an item from cart by product id or sku
 */
export async function removeFromCart({ userId, cartId }: CartLookup, productIdOrSku: string): Promise<Cart> {
  const supabase = await createClient()
  const cart = await getCart({ userId, cartId })
  if (!cart) throw new Error('Cart not found')

  const items = (cart.items ?? []).filter((i) => !(i.product_id === productIdOrSku || i.sku === productIdOrSku))

  const { data, error } = await supabase.from('carts').update({ items }).eq('id', cart.id).select().single()
  if (error) throw error
  return data as Cart
}

/**
 * Merge a guest cart into a user's cart and delete the guest cart
 */
export async function mergeGuestCartIntoUser(userId: string, guestCartId: string): Promise<Cart> {
  const supabase = await createClient()

  const userCart = await getCart({ userId })
  const guestCart = await getCart({ cartId: guestCartId })

  if (!guestCart) throw new Error('Guest cart not found')

  if (!userCart) {
    // Assign guest cart to user
    const { data, error } = await supabase.from('carts').update({ user_id: userId }).eq('id', guestCartId).select().single()
    if (error) throw error
    return data as Cart
  }

  // Merge items
  const merged = [...(userCart.items ?? [])]
  for (const gi of guestCart.items ?? []) {
    const idx = merged.findIndex((i) => i.product_id === gi.product_id || i.sku === gi.sku)
    if (idx === -1) merged.push(gi)
    else {
      merged[idx] = { ...merged[idx], quantity: (merged[idx].quantity || 0) + (gi.quantity || 0), total_price: ((merged[idx].unit_price || 0) * ((merged[idx].quantity || 0) + (gi.quantity || 0))) }
    }
  }

  const { data, error } = await supabase.from('carts').update({ items: merged }).eq('id', userCart.id).select().single()
  if (error) throw error

  // Delete guest cart
  const del = await supabase.from('carts').delete().eq('id', guestCartId)
  if (del.error) throw del.error

  return data as Cart
}

/**
 * Clear a cart (by userId or cartId)
 */
export async function clearCartServer({ userId, cartId }: CartLookup): Promise<void> {
  const supabase = await createClient()
  const cart = await getCart({ userId, cartId })
  if (!cart) return

  const { error } = await supabase.from('carts').update({ items: [] }).eq('id', cart.id)
  if (error) throw error
}
