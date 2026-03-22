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
        .select('warehouse_actions, pickup_payment_proof_required, invoice_number')
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
    const statusUpdate: Record<string, any> = type === 'pickup'
        ? { status: 'delivered', delivered_at: new Date().toISOString(), warehouse_actions: actions }
        : { status: 'shipped', shipped_at: new Date().toISOString(), warehouse_actions: actions }

    const { error } = await supabase
        .from('orders')
        .update(statusUpdate)
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

    // Auto-issue invoice for pickup orders when payment has been verified
    // (DPD orders wait for delivery confirmation — no auto-invoice)
    let invoiceIssued = false
    if (type === 'pickup' && !order.invoice_number) {
        const hasPaymentVerified = actions.some((a: any) => a.action === 'payment_verified')
        // Auto-invoice if: payment was verified OR order doesn't require payment proof (net30)
        if (hasPaymentVerified || !order.pickup_payment_proof_required) {
            try {
                const { issueOrderInvoiceAction, adminSendInvoiceEmailAction } = await import('@/app/actions/admin')
                await issueOrderInvoiceAction(orderId, { skipAdminCheck: true })
                await adminSendInvoiceEmailAction(orderId, { skipAdminCheck: true })
                invoiceIssued = true
            } catch (invoiceErr) {
                console.error('Auto-invoice failed (non-fatal):', invoiceErr)
            }
        }
    }

    return NextResponse.json({ success: true, invoiceIssued })
}
