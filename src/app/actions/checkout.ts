'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'
import { clearCartServer } from '@/lib/db/cart'
import { getMarketFromKey, MARKETS, EU_COUNTRY_CODES } from '@/lib/constants/markets'
import { sendEmail } from '@/lib/email'
import { buildOrderConfirmationEmail } from '@/lib/emails/order-confirmation'
import { getEffectivePrice } from '@/lib/db/pricing'
import { verifyRecaptcha } from '@/lib/recaptcha'

export type CheckoutState = {
    success?: boolean
    orderId?: string
    error?: string
    fieldErrors?: Record<string, string[]>
}

export async function placeOrder(prevState: CheckoutState, formData: FormData): Promise<CheckoutState> {
    const supabase = await createClient()

    // 0. Verify reCAPTCHA
    const recaptchaToken = formData.get('recaptcha_token') as string
    const recaptcha = await verifyRecaptcha(recaptchaToken)
    if (!recaptcha.success) {
        return { error: 'reCAPTCHA verification failed. Please try again.' }
    }

    // 1. Extract Data
    const rawData = Object.fromEntries(formData.entries())
    const itemsJson = formData.get('cart_items') as string
    const cartItems = JSON.parse(itemsJson || '[]')

    const email = rawData.email as string
    const createAccount = rawData.create_account === 'on'
    const password = rawData.password as string

    // Basic Validation
    if (!email || !email.includes('@')) return { error: 'Invalid email address' }
    if (cartItems.length === 0) return { error: 'Cart is empty' }
    if (createAccount && (!password || password.length < 6)) return { error: 'Password must be at least 6 characters' }

    try {
        // 2. Auth / User Handling
        let customerId = null
        let isB2B = false
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            customerId = user.id
            // Check if B2B customer
            isB2B = user.user_metadata?.customer_type === 'b2b'
        } else if (createAccount) {
            // Create new user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: rawData.shipping_first_name,
                        last_name: rawData.shipping_last_name,
                        phone: rawData.shipping_phone
                    }
                }
            })
            if (authError) return { error: authError.message }
            if (authData.user) customerId = authData.user.id
        }

        // 3. Verify Prices & Calculate Total
        // Fetch latest product prices to prevent tampering
        const productIds = cartItems.map((i: any) => i.product_id)
        const { data: products } = await supabase
            .from('products')
            .select('id, price_eur, weight_kg, is_electrical_equipment, trod_category_code, default_packaging_type, packaging_weight_per_unit_kg, cn_code')
            .in('id', productIds)

        if (!products) return { error: 'Failed to fetch product data' }

        let subtotal = 0
        let totalWeight = 0
        const orderItemsData = []

        for (const item of cartItems) {
            const product = (products as any[]).find((p: any) => p.id === item.product_id)
            if (!product) continue

            const pricing = await getEffectivePrice(product, customerId)
            const b2cPrice = pricing.originalPrice
            const unitPrice = pricing.discountedPrice
            const total = unitPrice * item.quantity
            const discountAmount = b2cPrice - unitPrice

            subtotal += total
            totalWeight += (product.weight_kg || 0) * item.quantity

            orderItemsData.push({
                product_id: product.id,
                sku: item.sku,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: unitPrice,
                b2c_unit_price: b2cPrice,
                discount_amount: discountAmount > 0 ? discountAmount : null,
                total_price: total,
                weight_kg: product.weight_kg,
                cn_code: product.cn_code,
                // Compliance
                applies_trod_fee: product.is_electrical_equipment,
                trod_category_code: product.trod_category_code,
                packaging_type: product.default_packaging_type,
                packaging_weight_kg: product.packaging_weight_per_unit_kg
            })
        }

        // 4. Shipping & VAT
        const shippingId = rawData.shipping_id as string
        let shippingCost = 0
        let shippingCarrier = 'Standard'
        let shippingMethod = 'Standard'

        if (shippingId) {
            const { data: rateData, error: rateError } = await supabase
                .from('shipping_rates')
                .select('*')
                .eq('id', shippingId)
                .single()

            if (rateError || !rateData) {
                console.error('Error fetching shipping rate:', rateError)
                return { error: 'Invalid shipping method selected' }
            }

            shippingCost = rateData.rate_eur
            shippingCarrier = rateData.carrier
            shippingMethod = rateData.service_type
        } else {
            shippingCost = totalWeight > 20 ? 0 : 15.00
        }

        // Resolve market from middleware header (server-side, tamper-proof)
        const headersList = await headers()
        const marketKey = headersList.get('x-market-key') || 'SHOP'
        const market = getMarketFromKey(marketKey)

        const vatRate = market.vatRate
        const isActuallyB2B = !!(rawData.vat_id && (isB2B || rawData.company_name))
        const vatAmount = isActuallyB2B ? 0 : (subtotal + shippingCost) * vatRate
        const grandTotal = subtotal + shippingCost + vatAmount

        // 5. Create Order
        const orderPayload = {
            order_number: `ORD-${Date.now()}`, // Simple ID generation
            customer_id: customerId,
            customer_email: email,
            customer_phone: rawData.shipping_phone,

            company_name: rawData.company_name || null,
            vat_id: rawData.vat_id || null,

            shipping_address: {
                first_name: rawData.shipping_first_name,
                last_name: rawData.shipping_last_name,
                street: rawData.shipping_street,
                city: rawData.shipping_city,
                postal_code: rawData.shipping_postal_code,
                country: rawData.shipping_country
            },
            billing_address: rawData.billing_same === 'on' ? {
                first_name: rawData.shipping_first_name,
                last_name: rawData.shipping_last_name,
                street: rawData.shipping_street,
                city: rawData.shipping_city,
                postal_code: rawData.shipping_postal_code,
                country: rawData.shipping_country
            } : {
                // Handle separate billing if implemented in form
                first_name: rawData.billing_first_name || rawData.shipping_first_name,
                last_name: rawData.billing_last_name || rawData.shipping_last_name,
                street: rawData.billing_street,
                city: rawData.billing_city,
                postal_code: rawData.billing_postal_code,
                country: rawData.billing_country
            },

            subtotal,
            shipping_cost: shippingCost,
            shipping_carrier: shippingCarrier,
            shipping_method: shippingMethod,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            total: grandTotal,
            currency: 'EUR',

            status: 'pending',
            payment_status: 'pending',
            payment_method: rawData.payment_method,

            total_weight_kg: totalWeight,
            commercial_access: rawData.commercial_access === 'on' || rawData.commercial_access === 'true' || !!rawData.commercial_access,
            truck_access_notes: (rawData.truck_access_notes as string) || null,

            // Compliance
            delivery_country: rawData.shipping_country,
            supplier_country: market.supplierCountry,
            transaction_type: rawData.shipping_country === market.supplierCountry
                ? 'domestic'
                : (EU_COUNTRY_CODES.includes(rawData.shipping_country as string) ? 'eu' : 'export'),

            market: market.key,

            // Language - from user preference (defaults to 'en' if not provided)
            language: (rawData.language as string) || 'en',

            // Terms agreement
            terms_agreed_at: new Date().toISOString()
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert(orderPayload)
            .select()
            .single()

        if (orderError) throw new Error(orderError.message)

        // 6. Insert Items
        const itemsWithOrderId = orderItemsData.map(i => ({ ...i, order_id: order.id }))
        const { error: itemsError } = await supabase.from('order_items').insert(itemsWithOrderId)

        if (itemsError) throw new Error(itemsError.message)

        // 7. Send Confirmation Email (fire-and-forget — don't block checkout)
        const orderLanguage = (rawData.language as string) || market.defaultLanguage || 'en'
        try {
            const { subject, html } = buildOrderConfirmationEmail({
                orderNumber: order.order_number,
                customerName: `${rawData.shipping_first_name} ${rawData.shipping_last_name}`,
                email,
                items: orderItemsData.map(i => ({
                    sku: i.sku,
                    name: i.product_name,
                    quantity: i.quantity,
                    unitPrice: i.unit_price,
                    originalUnitPrice: i.b2c_unit_price,
                    totalPrice: i.total_price,
                })),
                subtotal,
                shippingCost,
                vatAmount,
                total: grandTotal,
                currency: 'EUR',
                shippingAddress: orderPayload.shipping_address as { first_name?: string; last_name?: string; street?: string; city?: string; postal_code?: string; country?: string },
                paymentMethod: (rawData.payment_method as string) || 'invoice',
                language: orderLanguage,
            })

            await sendEmail({
                from: 'Tigo Energy Shop <noreply@tigoenergy.shop>',
                to: email,
                subject,
                html,
            })
        } catch (emailErr) {
            // Log but don't fail the order
            console.error('Failed to send order confirmation email:', emailErr)
        }

        // 8. Clear Cart (Server-side)
        const cartId = (await cookies()).get('cartId')?.value
        await clearCartServer({ userId: customerId, cartId })

        return { success: true, orderId: order.id }

    } catch (err: any) {
        console.error('Checkout error:', err)
        return { error: err.message || 'Failed to place order' }
    }
}
