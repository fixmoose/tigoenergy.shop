import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = await params
    const { email, type } = await req.json()
    if (!email || !type) return NextResponse.json({ error: 'Missing email or type' }, { status: 400 })

    const supabase = await createAdminClient()

    const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, email')
        .eq('email', email)
        .eq('is_warehouse', true)
        .single()
    if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Append to warehouse_actions
    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
    const action = type === 'pickup' ? 'marked_picked_up' : 'marked_dpd_picked_up'
    actions.push({
        action,
        by_email: driver.email,
        by_name: driver.name,
        at: new Date().toISOString(),
    })

    // Pickup = customer already has it → delivered. DPD = shipped (in transit).
    const statusUpdate = type === 'pickup'
        ? { status: 'delivered', delivered_at: new Date().toISOString(), warehouse_actions: actions }
        : { status: 'shipped', shipped_at: new Date().toISOString(), warehouse_actions: actions }

    const { error } = await supabase
        .from('orders')
        .update(statusUpdate)
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ success: true })
}
