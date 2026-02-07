import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore))
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import * as route from '../session/route'

describe('admin session API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieStore.set.mockClear()
    mockCookieStore.get.mockClear()
    mockCookieStore.delete.mockClear()
  })

  it('POST sets cookie when user is admin', async () => {
    const mockClient: any = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', user_metadata: { role: 'admin' } } } }) } }
      ; (createClient as any).mockResolvedValue(mockClient)

    const req = { json: vi.fn().mockResolvedValue({}) } as any
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    expect(mockCookieStore.set).toHaveBeenCalledWith('tigo-admin', '1', expect.any(Object))
  })

  it('POST unauthorized when not admin', async () => {
    const mockClient: any = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', user_metadata: { role: 'user' } } } }) } }
      ; (createClient as any).mockResolvedValue(mockClient)

    const req = { json: vi.fn().mockResolvedValue({}) } as any
    const res = await route.POST(req)
    expect(res.status).toBe(401)
  })

  it('DELETE clears cookie', async () => {
    const res = await route.DELETE({} as any)
    expect(res.status).toBe(200)
    expect(mockCookieStore.delete).toHaveBeenCalledWith('tigo-admin')
  })
})
