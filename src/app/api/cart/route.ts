import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCart, updateCartItem, removeFromCart, mergeGuestCartIntoUser, clearCartServer } from '@/lib/db/cart'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } = {} } = await supabase.auth.getUser()
    const userId = user?.id

    // Authenticated user cart has priority
    if (userId) {
      const cart = await getCart({ userId })
      return NextResponse.json({ cart })
    }

    // Fallback to guest cart via session cookie
    const cartId = request.cookies.get('cartId')?.value
    if (cartId) {
      const cart = await getCart({ cartId })
      return NextResponse.json({ cart })
    }

    return NextResponse.json({ cart: null })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Use POST with action param to perform update/remove/merge
  try {
    const body = await request.json()
    const { action } = body

    const supabase = await createClient()
    const { data: { user } = {} } = await supabase.auth.getUser()
    const userId = user?.id
    const cartId = request.cookies.get('cartId')?.value

    if (action === 'update') {
      const { productIdOrSku, updates } = body
      if (!productIdOrSku || !updates) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
      const cart = await updateCartItem({ userId, cartId }, productIdOrSku, updates)
      return NextResponse.json({ cart })
    }

    if (action === 'remove') {
      const { productIdOrSku } = body
      if (!productIdOrSku) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
      const cart = await removeFromCart({ userId, cartId }, productIdOrSku)
      return NextResponse.json({ cart })
    }

    if (action === 'merge') {
      const guestCartId = body.guestCartId || cartId
      if (!guestCartId || !userId) return NextResponse.json({ error: 'guestCartId and logged-in user required' }, { status: 400 })

      const merged = await mergeGuestCartIntoUser(userId, guestCartId)

      // Clear cookie
      const res = NextResponse.json({ cart: merged })
      res.cookies.set('cartId', '', { path: '/', maxAge: 0 })
      return res
    }

    if (action === 'clear') {
      await clearCartServer({ userId, cartId })
      return NextResponse.json({ cart: { id: cartId || 'new', items: [] } })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
