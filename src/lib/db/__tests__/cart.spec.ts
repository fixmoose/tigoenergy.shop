import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { getCart, addToCart, updateCartItem, removeFromCart, createCart } from '../cart'

const sampleCart = {
  id: 'cart-1',
  user_id: 'user-1',
  items: [{ product_id: 'prod-1', sku: 'TS4-AO-700', name: 'TS4', quantity: 1, unit_price: 350, total_price: 350 }],
}

function makeCartQuery(overrides: any = {}) {
  const query: any = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    in: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  query.in.mockReturnValue(query)

  query.single.mockResolvedValue({
    data: overrides.singleData ?? sampleCart,
    error: overrides.singleError ?? null
  })

  // If we have specific insert/update data, we can override the single() return
  if (overrides.insertData || overrides.updateData) {
    query.single = vi.fn().mockResolvedValue({
      data: overrides.insertData || overrides.updateData,
      error: null
    })
  }

  return query
}

describe('cart db utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('getCart returns cart when found by userId', async () => {
    const mockClient: any = { from: vi.fn().mockImplementation(() => makeCartQuery({ singleData: sampleCart })) }
      ; (createClient as any).mockResolvedValue(mockClient)

    const c = await getCart({ userId: 'user-1' })
    expect(c).not.toBeNull()
    expect(c?.user_id).toBe('user-1')
  })

  it('addToCart creates cart when none exists for user', async () => {
    const query = makeCartQuery()
    // 1. getCart({userId}) -> calls single()
    // 2. createCart() -> calls insert().select().single()
    query.single = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      .mockResolvedValueOnce({ data: { id: 'cart-new', user_id: 'user-x', items: [{ product_id: 'p1', sku: 'sku1', name: 'n', quantity: 2, unit_price: 10, total_price: 20 }] }, error: null })

    const mockClient: any = { from: vi.fn().mockReturnValue(query) }
      ; (createClient as any).mockResolvedValue(mockClient)

    const cart = await addToCart({ userId: 'user-x' }, { product_id: 'p1', sku: 'sku1', name: 'n', quantity: 2, unit_price: 10 })
    expect(cart).not.toBeNull()
    expect(cart.items[0].quantity).toBe(2)
  })

  it('addToCart creates guest cart when no userId provided', async () => {
    const query = makeCartQuery()
    // In guest case, getCart is skipped, so only createCart() calls single() ONCE
    query.single = vi.fn().mockResolvedValue({
      data: { id: 'guest-cart-1', user_id: null, items: [{ product_id: 'p1', sku: 'sku1', name: 'n', quantity: 1, unit_price: 10, total_price: 10 }] },
      error: null
    })

    const mockClient: any = { from: vi.fn().mockReturnValue(query) }
      ; (createClient as any).mockResolvedValue(mockClient)

    const cart = await addToCart({}, { product_id: 'p1', sku: 'sku1', name: 'n', quantity: 1, unit_price: 10 })
    expect(cart).not.toBeNull()
    expect(cart.id).toBe('guest-cart-1')
  })

  it('updateCartItem updates existing item by userId', async () => {
    const clientQuery = makeCartQuery({ singleData: sampleCart, updateData: { ...sampleCart, items: [{ product_id: 'prod-1', sku: 'TS4-AO-700', name: 'TS4', quantity: 5, unit_price: 350, total_price: 1750 }] } })
    const mockClient: any = { from: vi.fn().mockImplementation(() => clientQuery) }
      ; (createClient as any).mockResolvedValue(mockClient)

    const updated = await updateCartItem({ userId: 'user-1' }, 'TS4-AO-700', { quantity: 5 })
    expect(updated.items[0].quantity).toBe(5)
  })

  it('removeFromCart removes item by userId', async () => {
    const clientQuery = makeCartQuery({ singleData: sampleCart, updateData: { ...sampleCart, items: [] } })
    const mockClient: any = { from: vi.fn().mockImplementation(() => clientQuery) }
      ; (createClient as any).mockResolvedValue(mockClient)

    const updated = await removeFromCart({ userId: 'user-1' }, 'TS4-AO-700')
    expect(updated.items).toHaveLength(0)
  })
})
