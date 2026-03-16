'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'
import { clearCartServer } from '@/lib/db/cart'
import { getMarketFromKey, MARKETS, EU_COUNTRY_CODES } from '@/lib/constants/markets'
import { sendEmail, notifyAdmins } from '@/lib/email'
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
    const recaptcha = await verifyRecaptcha(recaptchaToken, 'CHECKOUT')
    if (!recaptcha.success) {
        return { success: false, error: 'reCAPTCHA verification failed. Please try again.' }
    }

    // 1. Extract Data
    const rawData = Object.fromEntries(formData.entries())
    const itemsJson = formData.get('cart_items') as string
    const cartItems = JSON.parse(itemsJson || '[]')

    const email = rawData.email as string
    const createAccount = rawData.create_account === 'on'
    const password = rawData.password as string

    // Basic Validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'Invalid email address' }
    if (cartItems.length === 0) return { success: false, error: 'Cart is empty' }
    if (createAccount && (!password || password.length < 6)) return { success: false, error: 'Password must be at least 6 characters' }

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
            if (authError) return { success: false, error: authError.message }
            if (authData.user) customerId = authData.user.id
        }

        // 3. Verify Prices & Calculate Total
        // Fetch latest product prices to prevent tampering
        const productIds = cartItems.map((i: any) => i.product_id)
        const { data: products } = await supabase
            .from('products')
            .select('id, price_eur, weight_kg, is_electrical_equipment, trod_category_code, default_packaging_type, packaging_weight_per_unit_kg, cn_code')
            .in('id', productIds)

        if (!products) return { success: false, error: 'Failed to fetch product data' }

        let subtotal = 0
        let totalWeight = 0
        const orderItemsData = []

        for (const item of cartItems) {
            const product = (products as any[]).find((p: any) => p.id === item.product_id)
            if (!product) continue

            const pricing = await getEffectivePrice(product, customerId, item.quantity)
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
                return { success: false, error: 'Invalid shipping method selected' }
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
            order_number: `ETRG-ORD-${Date.now()}`,
            customer_id: customerId,
            customer_email: email,
            customer_phone: rawData.shipping_phone,

            company_name: rawData.company_name || null,
            vat_id: rawData.vat_id || null,

            shipping_address: {
                first_name: rawData.shipping_first_name,
                last_name: rawData.shipping_last_name,
                street: rawData.shipping_street,
                street2: rawData.shipping_street2,
                city: rawData.shipping_city,
                postal_code: rawData.shipping_postal_code,
                country: rawData.shipping_country
            },
            billing_address: rawData.billing_same === 'on' ? {
                first_name: rawData.shipping_first_name,
                last_name: rawData.shipping_last_name,
                street: rawData.shipping_street,
                street2: rawData.shipping_street2,
                city: rawData.shipping_city,
                postal_code: rawData.shipping_postal_code,
                country: rawData.shipping_country
            } : {
                // Handle separate billing if implemented in form
                first_name: rawData.billing_first_name || rawData.shipping_first_name,
                last_name: rawData.billing_last_name || rawData.shipping_last_name,
                street: rawData.billing_street,
                street2: rawData.billing_street2,
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
            display_currency: (rawData.display_currency as string) || 'EUR',
            exchange_rate: parseFloat(rawData.exchange_rate as string) || 1.0,

            status: 'pending',
            payment_status: 'pending',
            payment_method: rawData.payment_method,

            total_weight_kg: totalWeight,
            po_number: (rawData.po_number as string) || null,
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

            // Order modification tracking
            ...(rawData.original_order_id ? {
                original_order_id: rawData.original_order_id as string,
                is_modification: true,
            } : {}),
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

        // 6b. Save shipping address to customer's address book (if logged in)
        if (customerId) {
            try {
                const { data: existingCustomer } = await supabase
                    .from('customers')
                    .select('addresses')
                    .eq('id', customerId)
                    .single()

                const currentAddresses: any[] = (existingCustomer?.addresses as any[]) || []
                const shippingAddr = {
                    street: rawData.shipping_street || '',
                    city: rawData.shipping_city || '',
                    postalCode: rawData.shipping_postal_code || '',
                    country: rawData.shipping_country || '',
                }

                // Only add if this address doesn't already exist
                const alreadyExists = currentAddresses.some((a: any) =>
                    a.street === shippingAddr.street &&
                    a.city === shippingAddr.city &&
                    a.postalCode === shippingAddr.postalCode &&
                    a.country === shippingAddr.country
                )

                if (!alreadyExists && shippingAddr.street) {
                    const newAddress = {
                        id: Math.random().toString(36).substr(2, 9),
                        label: currentAddresses.length === 0 ? 'Home' : 'Shipping',
                        ...shippingAddr,
                        street2: rawData.shipping_street2 || '',
                        isDefaultShipping: currentAddresses.length === 0,
                        isDefaultBilling: currentAddresses.length === 0,
                    }
                    await supabase
                        .from('customers')
                        .update({ addresses: [...currentAddresses, newAddress] })
                        .eq('id', customerId)
                }
            } catch (addrErr) {
                console.error('Failed to save address to customer profile:', addrErr)
            }
        }

        // 7. Determine Business Flow (Proforma vs Invoice)
        const isHighVolume = totalWeight > 500 || subtotal > 2500
        const isBankTransfer = rawData.payment_method === 'bank_transfer'
        const isProformaFlow = isBankTransfer || isHighVolume
        const isInterEuropa = shippingCarrier === 'InterEuropa'

        // Update order with these flags if columns exist (assuming they don't, we just use logic for email)
        // If we want to persist these, we might need a migration, but for now we follow the flow:
        const documentType = isProformaFlow ? 'proforma_invoice' : 'order_confirmation'

        // 8. Send Confirmation Email (fire-and-forget — don't block checkout)
        const orderLanguage = (rawData.language as string) || market.defaultLanguage || 'en'
        try {
            const { renderDatabaseTemplate } = await import('@/lib/email')
            const { generateItemsTableHtml } = await import('@/lib/document-service')

            const formatAddress = (addr: any) => {
                if (!addr) return 'N/A'
                return `${addr.street || addr.line1 || ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
            }

            const emailData: Record<string, string> = {
                order_number: String(order.order_number),
                order_date: new Date(order.created_at).toLocaleDateString(),
                customer_name: `${rawData.shipping_first_name} ${rawData.shipping_last_name}`,
                customer_email: String(email),
                customer_company: String(rawData.company_name || ''),
                customer_vat: String(rawData.vat_id || ''),
                shipping_address: formatAddress(orderPayload.shipping_address),
                billing_address: formatAddress(orderPayload.billing_address),
                subtotal_net: `EUR ${subtotal.toFixed(2)}`,
                vat_total: `EUR ${vatAmount.toFixed(2)}`,
                shipping_cost: `EUR ${shippingCost.toFixed(2)}`,
                total_amount: `EUR ${grandTotal.toFixed(2)}`,
                payment_method: String(rawData.payment_method || 'invoice'),
                items_table: generateItemsTableHtml(orderItemsData, 'EUR'),
                reference: `SI00 ${String(order.order_number).replace('ETRG-ORD-', '').slice(-6)}`,
                wise_payment_link: `<div style="text-align:center;margin-top:16px"><a href="https://wise.com/pay/business/initraenergijadoo?amount=${grandTotal.toFixed(2)}&currency=EUR&description=${String(order.order_number).replace('ETRG-ORD-', '').slice(-6)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">Pay Now with Wise</a></div>`
            }

            // Try to get dynamic template from DB
            const dbHtml = await renderDatabaseTemplate(documentType, emailData, orderLanguage)

            let finalHtml = ''
            let finalSubject = isProformaFlow
                ? (orderLanguage === 'sl' ? `Predračun — #${order.order_number}` : `Proforma Invoice — #${order.order_number}`)
                : (orderLanguage === 'sl' ? `Potrditev naročila — #${order.order_number}` : `Order Confirmation — #${order.order_number}`)

            const isExportOrder = orderPayload.transaction_type === 'export'

            if (dbHtml) {
                finalHtml = dbHtml
                // Append customs disclaimer for export orders using DB template
                if (isExportOrder) {
                    const customsLabels: Record<string, { title: string; body: string }> = {
                        en: { title: 'Important: Customs & Import Duties', body: 'This order is shipping outside the European Union. Customs duties, import taxes, and other fees are NOT included in the order total and are the sole responsibility of the buyer. Please contact your local customs authority to determine any additional charges before your shipment arrives. If delivery fails due to unpaid customs duties and goods are returned to us, a restocking fee will apply.' },
                        de: { title: 'Wichtig: Zölle & Einfuhrabgaben', body: 'Diese Bestellung wird außerhalb der Europäischen Union versendet. Zölle, Einfuhrsteuern und sonstige Gebühren sind NICHT im Bestellbetrag enthalten und liegen in der alleinigen Verantwortung des Käufers. Bitte erkundigen Sie sich bei Ihrer zuständigen Zollbehörde über mögliche Zusatzkosten, bevor Ihre Sendung eintrifft. Falls die Zustellung aufgrund nicht bezahlter Zollgebühren fehlschlägt und die Ware an uns zurückgesendet wird, fällt eine Wiedereinlagerungsgebühr an.' },
                        sl: { title: 'Pomembno: Carinske dajatve in uvozne takse', body: 'To naročilo se pošilja izven Evropske unije. Carinske dajatve, uvozni davki in druge pristojbine NISO vključene v skupni znesek naročila in so izključno odgovornost kupca. Pred prihodom pošiljke se prosim obrnite na pristojni carinski organ za informacije o morebitnih dodatnih stroških. V primeru neuspešne dostave zaradi neplačanih carinskih dajatev in vračila blaga se zaračuna pristojbina za vračilo na zalogo.' },
                    }
                    const cl = customsLabels[orderLanguage] || customsLabels.en
                    const disclaimerHtml = `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:24px 32px"><p style="font-size:14px;font-weight:700;color:#92400e;margin:0 0 8px">⚠️ ${cl.title}</p><p style="font-size:13px;color:#92400e;margin:0;line-height:1.5">${cl.body}</p></div>`
                    // Insert before closing </body> or append at end
                    finalHtml = finalHtml.includes('</body>')
                        ? finalHtml.replace('</body>', `${disclaimerHtml}</body>`)
                        : finalHtml + disclaimerHtml
                }
            } else {
                // Fallback to old hardcoded builder
                const fallback = buildOrderConfirmationEmail({
                    orderNumber: order.order_number,
                    customerName: emailData.customer_name,
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
                    shippingAddress: orderPayload.shipping_address as any,
                    paymentMethod: emailData.payment_method,
                    language: orderLanguage,
                    isExport: orderPayload.transaction_type === 'export',
                })
                finalHtml = fallback.html
                finalSubject = fallback.subject
            }

            await sendEmail({
                from: 'Tigo Energy Shop <support@tigoenergy.shop>',
                to: email,
                subject: finalSubject,
                html: finalHtml,
                orderId: order.id,
                emailType: 'order_confirmation',
            })

            // Notify all admins of new order
            const itemsListHtml = orderItemsData.map(i =>
                `<li>${i.product_name} (${i.sku}) x${i.quantity} — EUR ${i.total_price?.toFixed(2)}</li>`
            ).join('')
            notifyAdmins({
                subject: `[NEW ORDER] #${order.order_number} — ${emailData.customer_name} (EUR ${grandTotal.toFixed(2)})`,
                html: `
                    <h3>New Order Received: #${order.order_number}</h3>
                    <p><strong>Customer:</strong> ${emailData.customer_name} (${email})</p>
                    <p><strong>Company:</strong> ${emailData.customer_company || '—'}</p>
                    <p><strong>Payment:</strong> ${emailData.payment_method}</p>
                    <p><strong>Total:</strong> EUR ${grandTotal.toFixed(2)}</p>
                    <p><strong>Items:</strong></p>
                    <ul>${itemsListHtml}</ul>
                    <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL}/admin/orders/${order.id}">View Order in Admin</a></p>
                `,
            }).catch(err => console.error('Failed to send admin order notification:', err))
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

        notifyAdmins({
            subject: `[CHECKOUT ERROR] ${err.message || 'Unknown error'}`,
            html: `
                <h3>Checkout Error</h3>
                <p><strong>Error:</strong> ${err.message || 'Unknown error'}</p>
                <p><strong>Stack:</strong><pre style="font-size:11px">${err.stack || 'N/A'}</pre></p>
                <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            `,
        }).catch(() => {})

        return { success: false, error: err.message || 'Failed to place order' }
    }
}
