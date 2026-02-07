import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'
import type { Cart, CartItem } from '@/types/database'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id: customerId } = await params

  // Require authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', customerId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ carts: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id: customerId } = await params

  // Require authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as any
  const action = body.action || 'convert'

  if (action === 'convert') {
    const cartId = body.cartId as string | undefined

    // Find cart
    let cartRes
    if (cartId) cartRes = await supabase.from('carts').select('*').eq('id', cartId).limit(1).single()
    else cartRes = await supabase.from('carts').select('*').eq('user_id', customerId).order('created_at', { ascending: false }).limit(1).single()

    if (cartRes.error) return NextResponse.json({ error: cartRes.error.message }, { status: 500 })
    const cart = cartRes.data
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    if (!cart.items || cart.items.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })

    // Get customer
    const custRes = await supabase.from('customers').select('*').eq('id', customerId).limit(1).single()
    if (custRes.error) return NextResponse.json({ error: custRes.error.message }, { status: 500 })
    const customer = custRes.data

    // Build addresses
    const defaultShipping = (customer?.addresses ?? [])?.find((a: any) => a.id === customer?.default_shipping_address_id) ?? (customer?.addresses ?? [])[0] ?? {}
    const defaultBilling = (customer?.addresses ?? [])?.find((a: any) => a.id === customer?.default_billing_address_id) ?? (customer?.addresses ?? [])[0] ?? {}

    // Compute totals
    const subtotal = cart.items.reduce((s: number, it: CartItem) => s + ((it.total_price ?? (it.unit_price * it.quantity)) || 0), 0)
    const shipping_cost = 0
    const vat_rate = 0
    const vat_amount = 0
    const total = subtotal + shipping_cost + vat_amount

    // Create order number
    const now = new Date()
    const orderNumber = `SI-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-6)}`

    // Insert order
    const orderPayload = {
      order_number: orderNumber,
      customer_id: customerId,
      customer_email: customer?.email ?? '',
      customer_phone: customer?.phone ?? null,
      company_name: customer?.company_name ?? null,
      shipping_address: defaultShipping,
      billing_address: defaultBilling,
      subtotal: subtotal.toFixed(2),
      shipping_cost: shipping_cost.toFixed(2),
      vat_rate: vat_rate.toFixed(2),
      vat_amount: vat_amount.toFixed(2),
      total: total.toFixed(2),
      currency: 'EUR',
      market: 'en',
      language: 'en',
    }

    const orderRes = await supabase.from('orders').insert(orderPayload).select().single()
    if (orderRes.error) return NextResponse.json({ error: orderRes.error.message }, { status: 500 })
    const order = orderRes.data

    // Insert order items
    const orderItems = (cart.items ?? []).map((it: CartItem) => ({
      order_id: order.id,
      product_id: it.product_id ?? null,
      sku: it.sku ?? '',
      product_name: it.name ?? it.sku ?? '',
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
      total_price: it.total_price ?? (it.unit_price ?? 0) * (it.quantity ?? 1),
    }))

    const itemsRes = await supabase.from('order_items').insert(orderItems)
    if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 })

    // Delete cart
    const delRes = await supabase.from('carts').delete().eq('id', cart.id)
    if (delRes.error) return NextResponse.json({ error: delRes.error.message }, { status: 500 })

    return NextResponse.json({ order }, { status: 201 })
  }

  if (action === 'update') {
    const { cartId, items } = body
    if (!cartId) return NextResponse.json({ error: 'cartId required' }, { status: 400 })
    const { data, error } = await supabase.from('carts').update({ items }).eq('id', cartId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ cart: data })
  }

  if (action === 'delete') {
    const { cartId } = body
    if (!cartId) return NextResponse.json({ error: 'cartId required' }, { status: 400 })
    const { error } = await supabase.from('carts').delete().eq('id', cartId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
