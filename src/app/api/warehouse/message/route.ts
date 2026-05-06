import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/warehouse/message
// Warehouse staff sends a message (with optional file attachment) that
// appears as a notification in the admin bell + /admin/settings/messages.
// When order_id is included the notification title and metadata reference
// that order so admin can jump straight to it. Multiple messages can be
// sent for the same order over time.
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const email = form.get('email') as string | null
  const message = form.get('message') as string | null
  const file = form.get('file') as File | null
  const orderId = form.get('order_id') as string | null
  const deliveryId = form.get('delivery_id') as string | null

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (!message && (!file || file.size === 0)) {
    return NextResponse.json({ error: 'message or file required' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Verify driver
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name, email')
    .eq('email', email)
    .eq('is_warehouse', true)
    .single()
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 403 })

  // If order_id is present, pull the order_number for the notification title
  let orderNumber: string | null = null
  if (orderId) {
    const { data: order } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single()
    orderNumber = order?.order_number || null
  }

  let fileUrl: string | null = null
  let fileName: string | null = null

  if (file && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `warehouse-uploads/${Date.now()}_${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
      })
    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
    fileUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}`
    fileName = file.name
  }

  // Title varies based on whether the message is order-scoped or general
  const title = orderNumber
    ? `Sporočilo o naročilu #${orderNumber} od ${driver.name}`
    : `Sporočilo od ${driver.name}`

  // Append the message to the order's warehouse_actions log so it surfaces
  // inline with prep / pickup history on the admin order page. When a
  // delivery_id is also provided (worker is on a split-delivery card),
  // mirror it onto the delivery's audit log too — same JSON entry — so the
  // worker sees the thread on their card. Admin's order-page view picks
  // up everything via orders.warehouse_actions regardless.
  if (orderId && message) {
    const newAction = {
      action: 'warehouse_message',
      by_email: driver.email,
      by_name: driver.name,
      at: new Date().toISOString(),
      comment: message,
      ...(deliveryId ? { delivery_id: deliveryId } : {}),
      ...(fileUrl ? { file_url: fileUrl, file_name: fileName } : {}),
    }

    const { data: orderRow } = await supabase
      .from('orders')
      .select('warehouse_actions')
      .eq('id', orderId)
      .single()
    const actions = Array.isArray(orderRow?.warehouse_actions) ? [...orderRow!.warehouse_actions] : []
    actions.push(newAction)
    await supabase.from('orders').update({ warehouse_actions: actions }).eq('id', orderId)

    if (deliveryId) {
      const { data: delivery } = await supabase
        .from('order_deliveries')
        .select('warehouse_actions')
        .eq('id', deliveryId)
        .eq('order_id', orderId)
        .single()
      if (delivery) {
        const dActions = Array.isArray(delivery.warehouse_actions) ? [...delivery.warehouse_actions] : []
        dActions.push(newAction)
        await supabase.from('order_deliveries').update({ warehouse_actions: dActions }).eq('id', deliveryId)
      }
    }
  }

  // Create admin notification
  const { error: notifErr } = await supabase.from('admin_notifications').insert({
    type: 'warehouse_comment',
    title,
    message: message || (fileName ? `Priložen dokument: ${fileName}` : null),
    source: 'warehouse',
    source_name: driver.name,
    metadata: {
      ...(fileUrl ? { file_url: fileUrl, file_name: fileName } : {}),
      ...(orderId ? { order_id: orderId, order_number: orderNumber } : {}),
      ...(deliveryId ? { delivery_id: deliveryId } : {}),
      driver_email: driver.email,
    },
  })

  if (notifErr) {
    return NextResponse.json({ error: notifErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
