import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Update shipping_carrier per order item (split shipping).
 * POST body: { carriers: { [itemId]: carrierString | '' } }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: orderId } = await params
    const { carriers } = await req.json() as { carriers: Record<string, string> }

    if (!carriers || typeof carriers !== 'object') {
        return NextResponse.json({ error: 'Invalid carriers payload' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Verify order exists
    const { data: order } = await supabase.from('orders').select('id').eq('id', orderId).single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Update each item's shipping_carrier
    const updates = Object.entries(carriers).map(([itemId, carrier]) =>
        supabase
            .from('order_items')
            .update({ shipping_carrier: carrier || null })
            .eq('id', itemId)
            .eq('order_id', orderId)
    )

    await Promise.all(updates)

    return NextResponse.json({ ok: true })
}
