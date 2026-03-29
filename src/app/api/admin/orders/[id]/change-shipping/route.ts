import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { calculateTigoParcels, calculateDPDShippingCost } from '@/lib/shipping/dpd'

/**
 * Change shipping method on an order:
 *   - Recalculate shipping cost (DPD rates or 0 for pickup)
 *   - Recalculate VAT on new total
 *   - Update order totals
 *
 * POST body: { method: 'dpd' | 'pickup' }
 * Returns: { ok, shippingCost, boxCount, vatAmount, total }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createAdminClient()

    const body = await req.json()
    const { method, customShippingCost } = body // method: 'dpd' | 'pickup' | 'intereuropa'

    if (!method || !['dpd', 'pickup', 'intereuropa'].includes(method)) {
        return NextResponse.json({ error: 'Invalid method. Use "dpd", "pickup", or "intereuropa".' }, { status: 400 })
    }

    try {
        // Fetch order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // Fetch items for parcel calculation
        const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', id)

        let shippingCost = 0
        let shippingCarrier = 'Personal Pick-up'
        let shippingMethod = 'Personal Pick-up'
        let boxCount = 0

        if (method === 'dpd') {
            // Calculate parcels
            const parcels = calculateTigoParcels((items || []).map(i => ({
                sku: i.sku,
                name: i.product_name,
                quantity: i.quantity,
                weight_kg: i.weight_kg || 0,
            })))
            boxCount = parcels.length

            // Determine country from shipping address
            const shippingAddress = order.shipping_address as any
            const country = shippingAddress?.country || order.delivery_country || 'SI'

            // Fetch DPD rates for that country
            const { data: rates } = await supabase
                .from('shipping_rates')
                .select('min_weight_kg, max_weight_kg, rate_eur')
                .eq('country_code', country)
                .eq('carrier', 'DPD')
                .eq('active', true)

            shippingCost = calculateDPDShippingCost(parcels, rates || [])
            shippingCarrier = 'DPD'
            shippingMethod = 'DPD Classic'
        } else if (method === 'intereuropa') {
            if (customShippingCost == null || isNaN(Number(customShippingCost)) || Number(customShippingCost) < 0) {
                return NextResponse.json({ error: 'InterEuropa requires a valid customShippingCost.' }, { status: 400 })
            }
            shippingCost = Number(customShippingCost)
            shippingCarrier = 'InterEuropa'
            shippingMethod = 'Pallet'
        }

        // Recalculate VAT on new subtotal + shipping
        const subtotal = parseFloat(order.subtotal || 0)
        const vatRate = parseFloat(order.vat_rate || 0)

        // Check if this order was VAT exempt (B2B cross-border)
        const wasVatExempt = parseFloat(order.vat_amount || 0) === 0 && subtotal > 0
        // vatRate may be stored as percentage (22) or decimal (0.22) — normalize
        const vatDecimal = vatRate > 1 ? vatRate / 100 : vatRate
        const vatAmount = wasVatExempt ? 0 : (subtotal + shippingCost) * vatDecimal
        const total = subtotal + shippingCost + vatAmount

        // Update order
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                shipping_carrier: shippingCarrier,
                shipping_method: shippingMethod,
                shipping_cost: Math.round(shippingCost * 100) / 100,
                vat_amount: Math.round(vatAmount * 100) / 100,
                total: Math.round(total * 100) / 100,
            })
            .eq('id', id)

        if (updateError) throw updateError

        return NextResponse.json({
            ok: true,
            shippingCost: Math.round(shippingCost * 100) / 100,
            boxCount,
            vatAmount: Math.round(vatAmount * 100) / 100,
            total: Math.round(total * 100) / 100,
        })
    } catch (err: any) {
        console.error('Change shipping error:', err)
        return NextResponse.json({ error: err.message || 'Failed to change shipping' }, { status: 500 })
    }
}
