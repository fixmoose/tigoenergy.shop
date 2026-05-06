import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = await params
    const { email, actionType, delivery_id: deliveryId } = await req.json()
    if (!email || !actionType) return NextResponse.json({ error: 'Missing email or actionType' }, { status: 400 })

    // Only allow undoing these specific actions
    const undoable = ['marked_prepared', 'payment_verified']
    if (!undoable.includes(actionType)) {
        return NextResponse.json({ error: 'Action cannot be undone' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, email')
        .eq('email', email)
        .eq('is_warehouse', true)
        .single()
    if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Split-delivery card → undo from the delivery's audit log
    if (deliveryId) {
        const { data: delivery } = await supabase
            .from('order_deliveries')
            .select('warehouse_actions')
            .eq('id', deliveryId)
            .eq('order_id', orderId)
            .single()
        if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
        const dActions = Array.isArray(delivery.warehouse_actions) ? delivery.warehouse_actions : []
        const lastIdx = dActions.findLastIndex((a: any) => a.action === actionType)
        if (lastIdx === -1) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
        dActions.splice(lastIdx, 1)
        const dUpdate: Record<string, any> = { warehouse_actions: dActions }
        if (actionType === 'marked_prepared') {
            dUpdate.status = 'pending'
            dUpdate.prepared_at = null
        }
        const { error: dErr } = await supabase
            .from('order_deliveries')
            .update(dUpdate)
            .eq('id', deliveryId)
        if (dErr) return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 })

        // payment_verified is order-level — revert order's payment_status too if no other delivery still has it
        if (actionType === 'payment_verified') {
            await supabase
                .from('orders')
                .update({ payment_status: 'pending', paid_at: null })
                .eq('id', orderId)
        }
        return NextResponse.json({ success: true })
    }

    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
    const lastIdx = actions.findLastIndex((a: any) => a.action === actionType)
    if (lastIdx === -1) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    actions.splice(lastIdx, 1)

    const updatePayload: Record<string, any> = { warehouse_actions: actions }
    if (actionType === 'payment_verified') {
        const stillVerified = actions.some((a: any) => a.action === 'payment_verified')
        if (!stillVerified) {
            updatePayload.payment_status = 'pending'
            updatePayload.paid_at = null
        }
    }

    const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ success: true })
}
