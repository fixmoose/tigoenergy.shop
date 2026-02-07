import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { getProducts, getProductBySlug } from '../products'

const mockProduct = {
  id: 'prod-1',
  sku: 'TS4-AO-700',
  name_en: 'TS4-AO',
  category: 'optimizer',
  cost_eur: 200,
  price_eur: 350,
  weight_kg: 2,
}

function makeMockQuery(options: { singleResult?: any; rangeResult?: any; singleError?: any } = {}) {
  const query: any = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.ilike.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)

  query.range.mockResolvedValue({
    data: options.rangeResult ?? [mockProduct],
    error: null,
    count: (options.rangeResult ?? [mockProduct]).length
  })

  if (options.singleError) {
    query.single.mockResolvedValue({ data: null, error: options.singleError })
  } else {
    query.single.mockResolvedValue({ data: options.singleResult ?? null, error: null })
  }

  return query
}

describe('products db utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('getProducts returns list', async () => {
    const mockClient: any = { from: vi.fn().mockImplementation(() => makeMockQuery({ rangeResult: [mockProduct] })) }
      ; (createClient as any).mockResolvedValue(mockClient)

    const result = await getProducts()
    expect(result.products).toBeInstanceOf(Array)
    expect(result.products[0].sku).toBe('TS4-AO-700')
    expect(result.total).toBe(1)
    expect(mockClient.from).toHaveBeenCalledWith('products')
  })

  it('getProductBySlug returns item', async () => {
    const mockClient: any = { from: vi.fn().mockImplementation(() => makeMockQuery({ singleResult: mockProduct })) }
      ; (createClient as any).mockResolvedValue(mockClient)

    const p = await getProductBySlug('some-slug')
    expect(p).not.toBeNull()
    expect(p?.id).toBe('prod-1')
  })

  it('getProductBySlug returns null when not found', async () => {
    const notFoundError = { code: 'PGRST116' }
    const mockClient: any = { from: vi.fn().mockImplementation(() => makeMockQuery({ singleError: notFoundError })) }
      ; (createClient as any).mockResolvedValue(mockClient)

    const p = await getProductBySlug('missing')
    expect(p).toBeNull()
  })
})
