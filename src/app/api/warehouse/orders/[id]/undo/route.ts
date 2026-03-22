import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = await params
    const { email, actionType } = await req.json()
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

    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
    // Remove the last occurrence of this action type
    const lastIdx = actions.findLastIndex((a: any) => a.action === actionType)
    if (lastIdx === -1) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    actions.splice(lastIdx, 1)

    const updatePayload: Record<string, any> = { warehouse_actions: actions }

    // If undoing payment_verified, revert payment_status
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
