import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // In test environment, avoid Next's request cookies (not available in unit tests)
  if (process.env.NODE_ENV === 'test') {
    // Return a lightweight stubbed client for unit tests so we don't make network calls.
    const makeQuery = () => {
      const q: any = {}
      q.select = () => q
      q.eq = () => q
      q.ilike = () => q
      q.order = () => q
      q.range = async () => ({ data: [], error: null })
      q.limit = () => q
      q.single = async () => ({ data: null, error: null })
      q.maybeSingle = async () => ({ data: null, error: null })
      return q
    }

    return {
      from: () => {
        // Basic stub that supports select/eq/ilike/order/range/single/insert/update
        const q: any = {}
        q.select = () => q
        q.eq = () => q
        q.ilike = () => q
        q.order = () => q
        q.limit = () => q
        q.range = async () => ({ data: [], error: null })
        q.single = async () => ({ data: null, error: null })
        q.insert = async (payload: any) => ({ data: payload, error: null })
        q.update = async (payload: any) => ({ data: payload, error: null })
        return q
      },
      auth: { getUser: async () => ({ data: { user: null } }) },
      storage: { from: () => ({ upload: async () => ({ data: null, error: null }) }) },
    } as any
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie setting errors
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cookie removal errors
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase client with the service role key.
 * This client bypasses RLS and should ONLY be used in server-side code (APIs/Actions).
 */
export async function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() { return undefined },
        set() { },
        remove() { },
      },
    }
  )
}
