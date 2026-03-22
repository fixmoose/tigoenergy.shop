'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { getMarketFromKey, EU_COUNTRY_CODES } from '@/lib/constants/markets'
import { notifyAdmins } from '@/lib/email'
import { getEffectivePrice } from '@/lib/db/pricing'
import { calculateTigoParcels } from '@/lib/shipping/dpd'
import { sendWarehouseEmail } from '@/lib/warehouse'
import { clearCartServer } from '@/lib/db/cart'
import { cookies } from 'next/headers'

interface QuickOrderItem {
    product_id: string
    sku: string
    name: string
    quantity: number
    weight_kg: number
    category?: string | null
    subcategory?: string | null
}

interface QuickCheckoutResult {
    success: boolean
    orderId?: string
    orderNumber?: string
    error?: string
    shippingCost?: number
    boxCount?: number
    totalWithShipping?: number
}

/**
 * Place a quick order — streamlined for mobile.
 * mode: 'pickup' (Personal Pick-up) or 'delivery' (DPD to address on file)
 */
export async function placeQuickOrder(
    items: QuickOrderItem[],
    mode: 'pickup' | 'delivery'
): Promise<QuickCheckoutResult> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return { success: false, error: 'Not authenticated. Please sign in.' }

        // Get customer details
        const { data: customer } = await supabase
            .from('customers')
            .select('id, first_name, last_name, email, phone, company_name, vat_id, is_b2b, payment_terms, addresses')
            .eq('id', user.id)
            .single()

        if (!customer) return { success: false, error: 'Customer profile not found.' }

        // Get default shipping address
        const addresses = (customer.addresses || []) as any[]
        const defaultAddr = addresses.find((a: any) => a.isDefaultShipping && !a.isViesAddress)
            || addresses.find((a: any) => !a.isViesAddress)
            || addresses[0]

        if (mode === 'delivery' && !defaultAddr) {
            return { success: false, error: 'No delivery address on file. Please use the full checkout.' }
        }

        // Fetch fresh product prices
        const productIds = items.map(i => i.product_id)
        const { data: products } = await supabase
            .from('products')
            .select('id, price_eur, weight_kg, is_electrical_equipment, trod_category_code, default_packaging_type, packaging_weight_per_unit_kg, cn_code')
            .in('id', productIds)

        if (!products) return { success: false, error: 'Failed to verify products.' }

        let subtotal = 0
        let totalWeight = 0
        const orderItemsData: any[] = []

        for (const item of items) {
            const product = (products as any[]).find((p: any) => p.id === item.product_id)
            if (!product) continue

            const pricing = await getEffectivePrice(product, user.id, item.quantity)
            const b2cPrice = pricing.originalPrice
            const unitPrice = pricing.discountedPrice
            const total = unitPrice * item.quantity

            subtotal += total
            totalWeight += (product.weight_kg || 0) * item.quantity

            orderItemsData.push({
                product_id: product.id,
                sku: item.sku,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: unitPrice,
                b2c_unit_price: b2cPrice,
                discount_amount: b2cPrice - unitPrice > 0 ? b2cPrice - unitPrice : null,
                total_price: total,
                weight_kg: product.weight_kg,
                cn_code: product.cn_code,
                applies_trod_fee: product.is_electrical_equipment,
                trod_category_code: product.trod_category_code,
                packaging_type: product.default_packaging_type,
                packaging_weight_kg: product.packaging_weight_per_unit_kg,
            })
        }

        // Calculate shipping
        let shippingCost = 0
        let shippingCarrier = 'Personal Pick-up'
        let shippingMethod = 'Personal Pick-up'
        let boxCount = 0

        if (mode === 'delivery') {
            // Calculate DPD parcels
            const parcels = calculateTigoParcels(orderItemsData.map(i => ({
                sku: i.sku,
                name: i.product_name,
                quantity: i.quantity,
                weight_kg: i.weight_kg || 0,
            })))
            boxCount = parcels.length || 1

            // Fetch DPD rate for the address country
            const country = defaultAddr?.country || 'SI'
            const { data: rates } = await supabase
                .from('shipping_rates')
                .select('*')
                .eq('country_code', country)
                .eq('carrier', 'DPD')
                .eq('active', true)
                .lte('min_weight_kg', totalWeight)
                .gte('max_weight_kg', totalWeight)
                .limit(1)

            if (rates && rates.length > 0) {
                shippingCost = (rates[0].rate_eur || 0) * boxCount
            } else {
                // Fallback: default rate * box count
                shippingCost = 7.5 * boxCount
            }

            shippingCarrier = 'DPD'
            shippingMethod = 'DPD Classic'
        }

        // VAT
        const headersList = await headers()
        const marketKey = headersList.get('x-market-key') || 'SHOP'
        const market = getMarketFromKey(marketKey)
        const vatRate = market.vatRate
        const isB2B = !!(customer.vat_id && customer.is_b2b)
        const vatAmount = isB2B ? 0 : (subtotal + shippingCost) * vatRate
        const grandTotal = subtotal + shippingCost + vatAmount

        // Shipping address
        const shippingAddress = defaultAddr ? {
            first_name: customer.first_name || defaultAddr.firstName || '',
            last_name: customer.last_name || defaultAddr.lastName || '',
            street: defaultAddr.street || '',
            street2: defaultAddr.street2 || '',
            city: defaultAddr.city || '',
            postal_code: defaultAddr.postalCode || '',
            country: defaultAddr.country || 'SI',
        } : {
            first_name: customer.first_name || '',
            last_name: customer.last_name || '',
            street: '',
            city: '',
            postal_code: '',
            country: 'SI',
        }

        // Is pickup with non-net30? → payment proof required
        const isNet30 = customer.payment_terms === 'net30'
        const pickupPaymentProofRequired = mode === 'pickup' && !isNet30

        // Create order
        const orderPayload = {
            order_number: `ETRG-ORD-${Date.now()}`,
            customer_id: user.id,
            customer_email: customer.email || user.email,
            customer_phone: customer.phone || '',
            company_name: customer.company_name || null,
            vat_id: customer.vat_id || null,
            shipping_address: shippingAddress,
            billing_address: shippingAddress,
            subtotal,
            shipping_cost: shippingCost,
            shipping_carrier: shippingCarrier,
            shipping_method: shippingMethod,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            total: grandTotal,
            currency: 'EUR',
            display_currency: 'EUR',
            exchange_rate: 1.0,
            status: 'pending',
            payment_status: 'pending',
            payment_method: isNet30 ? 'invoice' : 'wise',
            total_weight_kg: totalWeight,
            delivery_country: shippingAddress.country,
            supplier_country: market.supplierCountry,
            transaction_type: shippingAddress.country === market.supplierCountry
                ? 'domestic'
                : (EU_COUNTRY_CODES.includes(shippingAddress.country) ? 'eu' : 'export'),
            market: market.key,
            language: headersList.get('x-preferred-language') || market.defaultLanguage || 'en',
            ...(pickupPaymentProofRequired ? { pickup_payment_proof_required: true } : {}),
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert(orderPayload)
            .select()
            .single()

        if (orderError) throw new Error(orderError.message)

        // Insert items
        const itemsWithOrderId = orderItemsData.map(i => ({ ...i, order_id: order.id }))
        const { error: itemsError } = await supabase.from('order_items').insert(itemsWithOrderId)
        if (itemsError) throw new Error(itemsError.message)

        // Auto-confirm pickup orders with full stock
        if (mode === 'pickup') {
            try {
                const { data: stockProducts } = await supabase
                    .from('products')
                    .select('id, stock_quantity, reserved_quantity')
                    .in('id', productIds)

                const allInStock = stockProducts?.every((product: any) => {
                    const orderedQty = orderItemsData.find(i => i.product_id === product.id)?.quantity || 0
                    const available = (product.stock_quantity || 0) - (product.reserved_quantity || 0)
                    return available >= orderedQty
                }) ?? false

                if (allInStock) {
                    const adminSupabase = await createAdminClient()
                    await adminSupabase.from('orders').update({
                        status: 'processing',
                        confirmed_at: new Date().toISOString(),
                        packing_slip_url: `/api/orders/${order.id}/packing-slip`,
                    }).eq('id', order.id)

                    // Notify warehouse (Milan)
                    const { data: warehouseWorkers } = await adminSupabase
                        .from('drivers')
                        .select('id, name, email')
                        .eq('is_warehouse', true)
                        .limit(1)

                    if (warehouseWorkers && warehouseWorkers.length > 0) {
                        const worker = warehouseWorkers[0]
                        const extraNote = pickupPaymentProofRequired
                            ? 'OBVEZNO PREVERITI DOKAZ O PLAČILU / VERIFY PROOF OF PAYMENT BEFORE RELEASE'
                            : undefined
                        await sendWarehouseEmail(order.id, worker.email, worker.name, extraNote)
                    }
                }
            } catch (autoConfirmErr) {
                console.error('Quick order auto-confirm error (non-fatal):', autoConfirmErr)
            }
        }

        // Notify admin
        const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email
        const itemsListHtml = orderItemsData.map(i =>
            `<li>${i.product_name} (${i.sku}) x${i.quantity} — EUR ${i.total_price?.toFixed(2)}</li>`
        ).join('')

        const modeLabel = mode === 'pickup' ? 'PICKUP' : 'DPD DELIVERY'
        notifyAdmins({
            subject: `[QUICK ORDER / ${modeLabel}] #${order.order_number} — ${customerName} (EUR ${grandTotal.toFixed(2)})`,
            html: `
                <h3>New Quick Order: #${order.order_number}</h3>
                <p><strong>Customer:</strong> ${customerName} (${customer.email})</p>
                <p><strong>Company:</strong> ${customer.company_name || '—'}</p>
                <p><strong>Method:</strong> ${modeLabel}${mode === 'delivery' ? ` (${boxCount} box${boxCount !== 1 ? 'es' : ''})` : ''}</p>
                <p><strong>Payment:</strong> ${isNet30 ? 'Net 30' : 'Prepayment'}${pickupPaymentProofRequired ? ' — PROOF REQUIRED AT PICKUP' : ''}</p>
                <p><strong>Total:</strong> EUR ${grandTotal.toFixed(2)}${shippingCost > 0 ? ` (incl. shipping EUR ${shippingCost.toFixed(2)})` : ''}</p>
                <p><strong>Items:</strong></p>
                <ul>${itemsListHtml}</ul>
                <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'}/admin/orders/${order.id}">View Order in Admin</a></p>
            `,
        }).catch(err => console.error('Failed to send admin quick order notification:', err))

        // Clear cart
        const cartId = (await cookies()).get('cartId')?.value
        await clearCartServer({ userId: user.id, cartId })

        return {
            success: true,
            orderId: order.id,
            orderNumber: order.order_number,
            shippingCost,
            boxCount,
            totalWithShipping: grandTotal,
        }

    } catch (err: any) {
        console.error('Quick checkout error:', err)
        notifyAdmins({
            subject: `[QUICK ORDER ERROR] ${err.message || 'Unknown error'}`,
            html: `<h3>Quick Checkout Error</h3><p>${err.message || 'Unknown error'}</p><pre>${err.stack || ''}</pre>`,
        }).catch(() => {})
        return { success: false, error: err.message || 'Failed to place order' }
    }
}
