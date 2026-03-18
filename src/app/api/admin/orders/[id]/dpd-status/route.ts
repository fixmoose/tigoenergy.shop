import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { DPDService } from '@/lib/shipping/dpd'

/**
 * GET /api/admin/orders/[id]/dpd-status
 * Fetches live DPD tracking status for an order's parcels.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params

    // Auth check — must be admin (cookie or user_metadata)
    const cookieStore = await cookies()
    const isAdminCookie = cookieStore.get('tigo-admin')?.value === '1'

    if (!isAdminCookie) {
        const userSupabase = await createClient()
        const { data: { user } } = await userSupabase.auth.getUser()
        if (!user || user.user_metadata?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    const supabase = await createAdminClient()

    // Get order tracking info
    const { data: order, error } = await supabase
        .from('orders')
        .select('tracking_number, shipping_carrier')
        .eq('id', orderId)
        .single()

    if (error || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
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
        return NextResponse.json({ error: err.message || 'Failed to fetch DPD status' }, { status: 502 })
    }
}
