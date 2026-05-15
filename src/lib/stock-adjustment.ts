/**
 * Decrement stock_quantity and reserved_quantity for a set of items.
 * Used when goods physically leave the warehouse — pickup or shipment.
 *
 * Items with no product_id (e.g. custom manual order rows) are skipped.
 * Negative quantities (returns) add stock back and don't touch reserved.
 */
export async function adjustStockForItems(
    supabase: any,
    items: { product_id: string | null | undefined; quantity: number }[]
): Promise<{ adjusted: number; skipped: number }> {
    let adjusted = 0
    let skipped = 0
    for (const item of items) {
        if (!item.product_id || !item.quantity) { skipped++; continue }
        const { data: product } = await supabase
            .from('products')
            .select('stock_quantity, reserved_quantity')
            .eq('id', item.product_id)
            .single()
        if (!product) { skipped++; continue }
        const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity)
        const newReserved = item.quantity > 0
            ? Math.max(0, (product.reserved_quantity || 0) - item.quantity)
            : (product.reserved_quantity || 0)
        await supabase
            .from('products')
            .update({ stock_quantity: newStock, reserved_quantity: newReserved })
            .eq('id', item.product_id)
        adjusted++
    }
    return { adjusted, skipped }
}

/**
 * Adjust stock for a single delivery (split-order scenario). Resolves each
 * order_item's product_id from the parent order, then deducts the delivery's
 * qty. Idempotent via a 'stock_adjusted' marker in delivery.warehouse_actions.
 */
export async function adjustStockForDelivery(supabase: any, deliveryId: string): Promise<{ adjusted: number; skipped?: number; reason?: string }> {
    const { data: delivery } = await supabase
        .from('order_deliveries')
        .select('id, order_id, items, warehouse_actions')
        .eq('id', deliveryId)
        .single()
    if (!delivery) return { adjusted: 0, reason: 'delivery not found' }

    const dActions = Array.isArray(delivery.warehouse_actions) ? delivery.warehouse_actions : []
    if (dActions.some((a: any) => a.action === 'stock_adjusted')) {
        return { adjusted: 0, reason: 'already adjusted' }
    }

    const dItems = typeof delivery.items === 'string' ? JSON.parse(delivery.items) : (delivery.items || [])
    const orderItemIds = dItems.map((d: any) => d.order_item_id).filter(Boolean)
    if (orderItemIds.length === 0) return { adjusted: 0, reason: 'no items' }

    const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, product_id')
        .in('id', orderItemIds)
    const productByItemId = new Map<string, string | null>((orderItems || []).map((i: any) => [i.id, i.product_id]))

    const itemsToAdjust = dItems.map((d: any) => ({
        product_id: productByItemId.get(d.order_item_id) ?? null,
        quantity: Number(d.qty),
    }))

    const res = await adjustStockForItems(supabase, itemsToAdjust)

    dActions.push({
        action: 'stock_adjusted',
        at: new Date().toISOString(),
        adjusted: res.adjusted,
        skipped: res.skipped,
    })
    await supabase
        .from('order_deliveries')
        .update({ warehouse_actions: dActions })
        .eq('id', deliveryId)

    return res
}

/**
 * Adjust stock for an entire order (no-delivery / single-shipment path).
 * Idempotent via order.stock_adjusted flag.
 */
export async function adjustStockForOrder(supabase: any, orderId: string): Promise<{ adjusted: number; skipped?: number; reason?: string }> {
    const { data: order } = await supabase
        .from('orders')
        .select('id, stock_adjusted')
        .eq('id', orderId)
        .single()
    if (!order) return { adjusted: 0, reason: 'order not found' }
    if (order.stock_adjusted) return { adjusted: 0, reason: 'already adjusted' }

    const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId)

    const res = await adjustStockForItems(supabase, items || [])

    await supabase
        .from('orders')
        .update({ stock_adjusted: true })
        .eq('id', orderId)

    return res
}
