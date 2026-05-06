import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = await params
    const { email, delivery_id: deliveryId } = await req.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const supabase = await createAdminClient()

    const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, email')
        .eq('email', email)
        .eq('is_warehouse', true)
        .single()
    if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const newAction = {
        action: 'payment_verified',
        by_email: driver.email,
        by_name: driver.name,
        at: new Date().toISOString(),
    }

    // Always flip the order to paid (payment is order-level, not delivery-level)
    const { error: orderErr } = await supabase
        .from('orders')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', orderId)
    if (orderErr) return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })

    // Split-delivery card → record the verification on the delivery's audit log
    if (deliveryId) {
        const { data: delivery } = await supabase
            .from('order_deliveries')
            .select('warehouse_actions')
            .eq('id', deliveryId)
            .eq('order_id', orderId)
            .single()
        if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
        const dActions = Array.isArray(delivery.warehouse_actions) ? delivery.warehouse_actions : []
        dActions.push(newAction)
        const { error: dErr } = await supabase
            .from('order_deliveries')
            .update({ warehouse_actions: dActions })
            .eq('id', deliveryId)
        if (dErr) return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
    actions.push(newAction)

    const { error } = await supabase
        .from('orders')
        .update({ warehouse_actions: actions })
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ success: true })
}
