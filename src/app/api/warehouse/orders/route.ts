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

    const selectFields = 'id, order_number, customer_email, company_name, shipping_address, shipping_carrier, shipping_method, packing_slip_url, shipping_label_url, invoice_url, invoice_number, total, currency, warehouse_actions, pickup_payment_proof_required, created_at, status, order_items(id, product_name, quantity, sku, shipping_carrier)'

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

    // Pull all order_deliveries for these orders. When an order has any
    // deliveries, the warehouse sees one card per pending/prepared delivery
    // (instead of one card for the whole order). Completed deliveries are
    // hidden from the active queue but resurface in the completed section.
    const activeOrderIds = (orders || []).map((o: any) => o.id)
    const { data: allDeliveries } = activeOrderIds.length > 0
        ? await supabase
            .from('order_deliveries')
            .select('*')
            .in('order_id', activeOrderIds)
        : { data: [] as any[] }
    const deliveriesByOrder = new Map<string, any[]>()
    for (const d of allDeliveries || []) {
        if (!deliveriesByOrder.has(d.order_id)) deliveriesByOrder.set(d.order_id, [])
        deliveriesByOrder.get(d.order_id)!.push(d)
    }

    // Build a virtual entry for one delivery on an order. Replaces the
    // order's order_items with the delivery's filtered+overridden quantities
    // and points the dobavnica URL at /api/orders/X/packing-slip?delivery=…
    const buildDeliveryEntry = (order: any, delivery: any) => {
        const dItems = typeof delivery.items === 'string' ? JSON.parse(delivery.items) : (delivery.items || [])
        const qtyById = new Map<string, number>(dItems.map((d: any) => [d.order_item_id, Number(d.qty)]))
        const filteredItems = (order.order_items || [])
            .filter((it: any) => qtyById.has(it.id))
            .map((it: any) => ({ ...it, quantity: qtyById.get(it.id) }))
        const carrier = delivery.carrier || order.shipping_carrier
        return {
            ...order,
            order_items: filteredItems,
            shipping_carrier: carrier,
            warehouse_actions: delivery.warehouse_actions || [],
            packing_slip_url: `/api/orders/${order.id}/packing-slip?delivery=${delivery.id}`,
            _delivery_id: delivery.id,
            _delivery_part: delivery.part_number,
            _delivery_total: delivery.total_parts,
            _delivery_status: delivery.status,
        }
    }

    const pickup: any[] = []
    const delivery: any[] = []
    for (const order of (orders || []) as any[]) {
        const orderDeliveries = deliveriesByOrder.get(order.id) || []
        // Active deliveries = pending or prepared (not yet completed)
        const activeDeliveries = orderDeliveries
            .filter((d: any) => d.status !== 'completed')
            .sort((a: any, b: any) => a.part_number - b.part_number)

        if (orderDeliveries.length > 0) {
            // Order has split deliveries — emit one card per active delivery
            for (const d of activeDeliveries) {
                const entry = buildDeliveryEntry(order, d)
                const carrier = entry.shipping_carrier
                if (carrier === 'InterEuropa') continue
                if (carrier === 'Personal Pick-up') pickup.push(entry)
                else delivery.push(entry)
            }
            continue
        }

        // No deliveries — fall back to legacy per-item-carrier split
        const items = order.order_items || []
        const groups = new Map<string, any[]>()
        for (const item of items) {
            const carrier = item.shipping_carrier || order.shipping_carrier || 'Unknown'
            if (!groups.has(carrier)) groups.set(carrier, [])
            groups.get(carrier)!.push(item)
        }

        if (groups.size <= 1) {
            if (order.shipping_carrier === 'Personal Pick-up') pickup.push(order)
            else delivery.push(order)
        } else {
            const totalParts = groups.size
            let partIdx = 0
            for (const [carrier, carrierItems] of groups) {
                partIdx++
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
