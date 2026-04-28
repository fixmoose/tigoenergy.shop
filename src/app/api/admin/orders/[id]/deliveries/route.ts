import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function requireAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('tigo-admin')?.value === '1'
}

interface DeliveryItem {
  order_item_id: string
  qty: number
  product_name?: string
  sku?: string
}

// Recompute total_parts on every row of an order so "(2/3)" headers stay
// accurate after inserts/deletes.
async function refreshTotalParts(supabase: any, orderId: string) {
  const { data: rows } = await supabase
    .from('order_deliveries')
    .select('id')
    .eq('order_id', orderId)
  const total = rows?.length || 0
  if (total > 0) {
    await supabase.from('order_deliveries').update({ total_parts: total }).eq('order_id', orderId)
  }
  return total
}

// GET /api/admin/orders/[id]/deliveries
// List all deliveries on an order, plus a summary of how many of each
// order_item have been allocated already (so the create form knows the
// remaining unassigned qty).
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: orderId } = await context.params
  const supabase = await createAdminClient()

  const [deliveriesRes, itemsRes] = await Promise.all([
    supabase
      .from('order_deliveries')
      .select('*')
      .eq('order_id', orderId)
      .order('part_number'),
    supabase
      .from('order_items')
      .select('id, product_name, sku, quantity, unit_price')
      .eq('order_id', orderId),
  ])

  const deliveries = deliveriesRes.data || []
  const items = itemsRes.data || []

  // For each order_item, sum qty already allocated across deliveries
  const allocated: Record<string, number> = {}
  for (const d of deliveries) {
    const dItems: DeliveryItem[] = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || [])
    for (const it of dItems) {
      allocated[it.order_item_id] = (allocated[it.order_item_id] || 0) + Number(it.qty || 0)
    }
  }
  const itemsWithRemaining = items.map(it => ({
    ...it,
    allocated: allocated[it.id] || 0,
    remaining: it.quantity - (allocated[it.id] || 0),
  }))

  return NextResponse.json({ success: true, data: { deliveries, items: itemsWithRemaining } })
}

// POST /api/admin/orders/[id]/deliveries
// Create a new delivery. Body: { items: [{order_item_id, qty}], carrier?, notes? }
// Validates that no item's allocated qty exceeds the order_item.quantity.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: orderId } = await context.params
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Load order_items + existing deliveries to validate allocation
  const [itemsRes, existingRes] = await Promise.all([
    supabase.from('order_items').select('id, product_name, sku, quantity').eq('order_id', orderId),
    supabase.from('order_deliveries').select('items, part_number').eq('order_id', orderId),
  ])
  const orderItems = itemsRes.data || []
  const orderItemMap = new Map(orderItems.map(i => [i.id, i]))

  // Sum existing allocations per item
  const existingAlloc: Record<string, number> = {}
  for (const d of existingRes.data || []) {
    const dItems: DeliveryItem[] = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || [])
    for (const it of dItems) {
      existingAlloc[it.order_item_id] = (existingAlloc[it.order_item_id] || 0) + Number(it.qty || 0)
    }
  }

  // Validate + enrich items with product_name + sku
  const enrichedItems: DeliveryItem[] = []
  for (const raw of body.items) {
    const oi = orderItemMap.get(raw.order_item_id)
    if (!oi) {
      return NextResponse.json({ error: `Unknown order_item ${raw.order_item_id}` }, { status: 400 })
    }
    const qty = Number(raw.qty)
    if (!qty || qty <= 0) continue  // skip empty rows
    const remaining = oi.quantity - (existingAlloc[oi.id] || 0)
    if (qty > remaining) {
      return NextResponse.json({
        error: `${oi.product_name}: only ${remaining} pcs remaining, requested ${qty}`,
      }, { status: 400 })
    }
    enrichedItems.push({
      order_item_id: oi.id,
      qty,
      product_name: oi.product_name,
      sku: oi.sku,
    })
  }
  if (enrichedItems.length === 0) {
    return NextResponse.json({ error: 'No items selected for this delivery' }, { status: 400 })
  }

  const nextPart = (existingRes.data?.length || 0) + 1
  const { data: created, error } = await supabase
    .from('order_deliveries')
    .insert({
      order_id: orderId,
      part_number: nextPart,
      total_parts: nextPart,  // refreshed below
      items: JSON.stringify(enrichedItems),
      carrier: body.carrier || null,
      notes: body.notes || null,
      status: 'pending',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Refresh total_parts on every delivery row (now there's nextPart of them)
  await refreshTotalParts(supabase, orderId)

  return NextResponse.json({ success: true, data: created })
}

// DELETE /api/admin/orders/[id]/deliveries?delivery_id=…
// Remove a delivery (only if not yet completed). Re-numbers remaining parts.
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: orderId } = await context.params
  const deliveryId = req.nextUrl.searchParams.get('delivery_id')
  if (!deliveryId) return NextResponse.json({ error: 'delivery_id required' }, { status: 400 })

  const supabase = await createAdminClient()
  const { data: existing } = await supabase
    .from('order_deliveries')
    .select('id, status')
    .eq('id', deliveryId)
    .single()
  if (!existing) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  if (existing.status === 'completed') {
    return NextResponse.json({ error: 'Cannot delete a completed delivery' }, { status: 400 })
  }

  const { error } = await supabase.from('order_deliveries').delete().eq('id', deliveryId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Renumber remaining deliveries in order, refresh total_parts
  const { data: remaining } = await supabase
    .from('order_deliveries')
    .select('id, part_number')
    .eq('order_id', orderId)
    .order('part_number')
  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await supabase.from('order_deliveries').update({ part_number: i + 1, total_parts: remaining.length }).eq('id', remaining[i].id)
    }
  }

  return NextResponse.json({ ok: true })
}
