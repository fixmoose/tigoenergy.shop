import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { DPDService } from '@/lib/shipping/dpd'

/**
 * GET /api/orders/[id]/dpd-status
 * Customer-facing endpoint: fetches live DPD tracking status for their order.
 * Auth: must be logged in and own the order, OR be admin.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params

    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // Get order — verify ownership or admin
    const { data: order, error } = await supabase
        .from('orders')
        .select('user_id, tracking_number, shipping_carrier')
        .eq('id', orderId)
        .single()

    if (error || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check ownership or admin role
    if (order.user_id !== user.id) {
        const { data: profile } = await supabase
            .from('customers')
            .select('id')
            .eq('id', user.id)
            .single()

        const isAdmin = user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin'
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    if (order.shipping_carrier !== 'DPD' || !order.tracking_number) {
        return NextResponse.json({ error: 'No DPD tracking available' }, { status: 400 })
    }

    const parcelNumbers = order.tracking_number
        .split(',')
        .map((n: string) => n.trim())
        .filter(Boolean)

    if (parcelNumbers.length === 0) {
        return NextResponse.json({ error: 'No parcel numbers' }, { status: 400 })
    }

    try {
        const dpd = new DPDService()
        const statuses = await dpd.getParcelStatus(parcelNumbers)
        return NextResponse.json({ parcels: statuses })
    } catch (err: any) {
        console.error('DPD status fetch error:', err)
        return NextResponse.json({ error: 'Failed to fetch tracking status' }, { status: 502 })
    }
}
