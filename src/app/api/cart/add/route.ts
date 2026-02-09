import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { addToCart } from '@/lib/db/cart'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cartId: bodyCartId, item } = body

    // Validate basic item shape
    if (!item || !item.sku || !item.product_id || !item.quantity) {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 })
    }

    // Determine identifier (user or guest cart)
    const supabase = await createClient()
    const { data: { user } = {} } = await supabase.auth.getUser()
    const userId = user?.id

    // Check for cartId in body or cookie
    const cookieCartId = request.cookies.get('cartId')?.value
    const cartId = bodyCartId || cookieCartId

    // Allow guest carts, but don't persist them (session cookie)
    const cart = await addToCart({ userId, cartId }, item)

    const res = NextResponse.json({ cart, cartId: cart.id })

    // If guest (no user), set a SESSION cookie (no maxAge)
    if (!userId && cart?.id) {
      res.cookies.set('cartId', cart.id, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        // Omitting maxAge and expires makes it a session cookie
      })
    }

    return res
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
