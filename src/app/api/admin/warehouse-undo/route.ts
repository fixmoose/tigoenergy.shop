import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/warehouse-undo
 * Body: { orderId, actionIndex }
 * Removes a warehouse action by index from the warehouse_actions array.
 * If the removed action was a completion (picked_up / dpd_picked_up),
 * reverts order status back to 'processing'.
 */
export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, actionIndex } = await req.json()
    if (!orderId || actionIndex === undefined) {
        return NextResponse.json({ error: 'Missing orderId or actionIndex' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions, status')
        .eq('id', orderId)
        .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? [...order.warehouse_actions] : []
    if (actionIndex < 0 || actionIndex >= actions.length) {
        return NextResponse.json({ error: 'Invalid action index' }, { status: 400 })
    }

    const removed = actions[actionIndex]
    actions.splice(actionIndex, 1)

    // If we're undoing a completion action, revert order status to processing
    const isCompletionUndo = removed.action === 'marked_picked_up' || removed.action === 'marked_dpd_picked_up'
    const statusUpdate: any = { warehouse_actions: actions }
    if (isCompletionUndo) {
        statusUpdate.status = 'processing'
        statusUpdate.shipped_at = null
        statusUpdate.delivered_at = null
    }

    const { error } = await supabase
        .from('orders')
        .update(statusUpdate)
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ success: true, undone: removed.action, statusReverted: isCompletionUndo })
}
