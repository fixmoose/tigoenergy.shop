/**
 * Auto-split a multi-carrier order into one order_deliveries row per
 * shipping_carrier. Idempotent: skips if any deliveries already exist
 * on the order. No-op for single-carrier orders.
 *
 * Items inherit the order's shipping_carrier when no per-item override
 * is set. The created deliveries carry full quantities (so the existing
 * deliveries flow — packing-slip ?delivery=, /warehouse cards, complete
 * with delivery_id — works untouched).
 */
export async function autoSplitDeliveriesByCarrier(supabase: any, orderId: string): Promise<{ created: number; reason?: string }> {
    const { data: existing } = await supabase
        .from('order_deliveries')
        .select('id')
        .eq('order_id', orderId)
        .limit(1)
    if (existing && existing.length > 0) return { created: 0, reason: 'deliveries already exist' }

    const { data: order } = await supabase
        .from('orders')
        .select('shipping_carrier')
        .eq('id', orderId)
        .single()
    if (!order) return { created: 0, reason: 'order not found' }

    const { data: items } = await supabase
        .from('order_items')
        .select('id, sku, product_name, quantity, shipping_carrier')
        .eq('order_id', orderId)
    if (!items || items.length === 0) return { created: 0, reason: 'no items' }

    // Group items by effective carrier
    const orderCarrier = order.shipping_carrier || 'Unknown'
    const groups = new Map<string, any[]>()
    for (const it of items) {
        const carrier = it.shipping_carrier || orderCarrier
        if (!groups.has(carrier)) groups.set(carrier, [])
        groups.get(carrier)!.push(it)
    }
    if (groups.size <= 1) return { created: 0, reason: 'single carrier — no split needed' }

    // Insert one delivery per carrier group
    const totalParts = groups.size
    const rows: any[] = []
    let part = 0
    for (const [carrier, carrierItems] of groups) {
        part++
        const deliveryItems = carrierItems.map(it => ({
            order_item_id: it.id,
            qty: it.quantity,
            product_name: it.product_name,
            sku: it.sku,
        }))
        rows.push({
            order_id: orderId,
            part_number: part,
            total_parts: totalParts,
            items: JSON.stringify(deliveryItems),
            carrier,
            status: 'pending',
            notes: `Auto-split by per-item shipping_carrier (${carrier} — ${carrierItems.length} line(s))`,
        })
    }
    const { error } = await supabase.from('order_deliveries').insert(rows)
    if (error) return { created: 0, reason: error.message }
    return { created: rows.length }
}
