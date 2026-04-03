import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

async function validateWarehouseEmail(supabase: any, email: string) {
    const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, email')
        .eq('email', email)
        .eq('is_warehouse', true)
        .single()
    return driver
}

export async function GET(req: NextRequest) {
    const email = req.nextUrl.searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const supabase = await createAdminClient()
    const driver = await validateWarehouseEmail(supabase, email)
    if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const selectFields = 'id, order_number, customer_email, company_name, shipping_address, shipping_carrier, shipping_method, packing_slip_url, shipping_label_url, total, currency, warehouse_actions, pickup_payment_proof_required, created_at, status, order_items(id, product_name, quantity, sku, shipping_carrier)'

    // Active orders (processing)
    const { data: orders, error } = await supabase
        .from('orders')
        .select(selectFields)
        .in('status', ['processing'])
        .order('created_at', { ascending: true })

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Recently completed orders (shipped/delivered/completed) with pagination
    const completedDays = parseInt(req.nextUrl.searchParams.get('completed_days') || '30') || 30
    const completedOffset = parseInt(req.nextUrl.searchParams.get('completed_offset') || '0') || 0
    const completedLimit = parseInt(req.nextUrl.searchParams.get('completed_limit') || '20') || 20
    const cutoff = new Date(Date.now() - completedDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: completedOrders, count: completedTotal } = await supabase
        .from('orders')
        .select(selectFields, { count: 'exact' })
        .in('status', ['shipped', 'delivered', 'completed'])
        .gte('updated_at', cutoff)
        .not('warehouse_actions', 'eq', '[]')
        .order('updated_at', { ascending: false })
        .range(completedOffset, completedOffset + completedLimit - 1)

    // Split orders with mixed per-item carriers into virtual entries
    // e.g. order with 2 items pickup + 1 item InterEuropa → 2 entries (pickup shown in warehouse, InterEuropa excluded)
    const pickup: any[] = []
    const delivery: any[] = []
    for (const order of (orders || []) as any[]) {
        const items = order.order_items || []
        // Group items by effective carrier
        const groups = new Map<string, any[]>()
        for (const item of items) {
            const carrier = item.shipping_carrier || order.shipping_carrier || 'Unknown'
            if (!groups.has(carrier)) groups.set(carrier, [])
            groups.get(carrier)!.push(item)
        }

        if (groups.size <= 1) {
            // Single carrier — original behavior
            if (order.shipping_carrier === 'Personal Pick-up') pickup.push(order)
            else delivery.push(order)
        } else {
            // Split shipping — create a virtual entry per warehouse-relevant carrier
            const totalParts = groups.size
            let partIdx = 0
            for (const [carrier, carrierItems] of groups) {
                partIdx++
                // InterEuropa is handled in admin, not warehouse
                if (carrier === 'InterEuropa') continue

                const carrierParam: Record<string, string> = {
                    'Personal Pick-up': 'pickup',
                    'DPD': 'dpd',
                }
                const virtualEntry = {
                    ...order,
                    order_items: carrierItems,
                    _split_carrier: carrier,
                    _split_part: partIdx,
                    _split_total: totalParts,
                    _split_carrier_param: carrierParam[carrier] || carrier.toLowerCase(),
                }
                if (carrier === 'Personal Pick-up') pickup.push(virtualEntry)
                else delivery.push(virtualEntry)
            }
        }
    }

    return NextResponse.json({
        pickup,
        delivery,
        completed: completedOrders || [],
        completedTotal: completedTotal || 0,
        driverName: driver.name,
    })
}
