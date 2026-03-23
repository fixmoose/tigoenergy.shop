'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { getMarketFromKey, EU_COUNTRY_CODES } from '@/lib/constants/markets'
import { sendEmail, notifyAdmins, renderDatabaseTemplate } from '@/lib/email'
import { buildOrderConfirmationEmail } from '@/lib/emails/order-confirmation'
import { generateItemsTableHtml } from '@/lib/document-service'
import { getEffectivePrice } from '@/lib/db/pricing'
import { calculateTigoParcels, calculateDPDShippingCost } from '@/lib/shipping/dpd'
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
            .select('id, first_name, last_name, email, phone, company_name, vat_id, is_b2b, payment_terms, payment_terms_days, addresses')
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
            .select('id, price_eur, b2b_price_eur, weight_kg, is_electrical_equipment, trod_category_code, default_packaging_type, packaging_weight_per_unit_kg, cn_code')
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

            // Fetch all DPD weight bands for the address country, price per parcel
            const country = defaultAddr?.country || 'SI'
            const { data: rates } = await supabase
                .from('shipping_rates')
                .select('min_weight_kg, max_weight_kg, rate_eur')
                .eq('country_code', country)
                .eq('carrier', 'DPD')
                .eq('active', true)

            shippingCost = calculateDPDShippingCost(parcels, rates || [])

            shippingCarrier = 'DPD'
            shippingMethod = 'DPD Classic'
        }

        // VAT
        const headersList = await headers()
        const marketKey = headersList.get('x-market-key') || 'SHOP'
        const market = getMarketFromKey(marketKey)
        const vatRate = market.vatRate
        const isB2B = !!(customer.vat_id && customer.is_b2b)
        const shippingCountry = defaultAddr?.country || 'SI'
        const isSlovenianB2B = isB2B && shippingCountry === 'SI'
        const vatExemptB2B = isB2B && !isSlovenianB2B
        const vatAmount = vatExemptB2B ? 0 : (subtotal + shippingCost) * vatRate
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
            ...(isNet30 ? {
                payment_terms: 'net30',
                payment_due_date: new Date(Date.now() + (customer.payment_terms_days || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            } : {}),
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
        let autoConfirmed = false
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
                    autoConfirmed = true
                    const adminSupabase = await createAdminClient()
                    await adminSupabase.from('orders').update({
                        status: 'processing',
                        confirmed_at: new Date().toISOString(),
                        packing_slip_url: `/api/orders/${order.id}/packing-slip`,
                    }).eq('id', order.id)

                    // Notify all auto-pickup flagged drivers
                    const { data: warehouseWorkers } = await adminSupabase
                        .from('drivers')
                        .select('id, name, email')
                        .eq('is_auto_pickup', true)

                    if (warehouseWorkers && warehouseWorkers.length > 0) {
                        const extraNote = pickupPaymentProofRequired
                            ? 'OBVEZNO PREVERITI DOKAZ O PLAČILU PRED IZDAJO BLAGA!'
                            : undefined
                        await Promise.all(warehouseWorkers.map(worker =>
                            sendWarehouseEmail(order.id, worker.email, worker.name, extraNote)
                        ))
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

        // Send order confirmation email to customer
        try {
            const orderLanguage = (orderPayload.language as string) || 'sl'
            const formatAddress = (addr: any) => {
                if (!addr) return 'N/A'
                return [
                    [addr.first_name, addr.last_name].filter(Boolean).join(' '),
                    addr.street || '', addr.street2 || '',
                    `${addr.postal_code || ''} ${addr.city || ''}`.trim(),
                    addr.country || '',
                ].filter(Boolean).join('<br>')
            }

            const isProformaFlow = orderPayload.payment_method === 'wise'
            const documentType = isProformaFlow ? 'proforma_invoice' : 'order_confirmation'

            const emailData: Record<string, string> = {
                order_number: String(order.order_number),
                order_date: new Date(order.created_at).toLocaleDateString(),
                customer_name: customerName,
                customer_email: String(orderPayload.customer_email),
                customer_company: String(orderPayload.company_name || ''),
                customer_vat: String(orderPayload.vat_id || ''),
                shipping_address: formatAddress(orderPayload.shipping_address),
                billing_address: formatAddress(orderPayload.billing_address),
                subtotal_net: `EUR ${subtotal.toFixed(2)}`,
                vat_total: `EUR ${vatAmount.toFixed(2)}`,
                shipping_cost: `EUR ${shippingCost.toFixed(2)}`,
                total_amount: `EUR ${grandTotal.toFixed(2)}`,
                payment_method: String(orderPayload.payment_method),
                items_table: generateItemsTableHtml(orderItemsData, 'EUR'),
                reference: `SI00 ${String(order.order_number).replace('ETRG-ORD-', '').slice(-6)}`,
                wise_payment_link: isProformaFlow
                    ? `<div style="text-align:center;margin-top:16px"><a href="https://wise.com/pay/business/initraenergijadoo?amount=${grandTotal.toFixed(2)}&currency=EUR&description=${String(order.order_number).replace('ETRG-ORD-', '').slice(-6)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">Pay Now with Wise</a></div>`
                    : '',
            }

            const subjectLabels: Record<string, { proforma: string; confirmation: string }> = {
                sl: { proforma: 'Predračun', confirmation: 'Potrditev naročila' },
                hr: { proforma: 'Predračun', confirmation: 'Potvrda narudžbe' },
                de: { proforma: 'Proforma-Rechnung', confirmation: 'Bestellbestätigung' },
                it: { proforma: 'Fattura proforma', confirmation: 'Conferma ordine' },
                cs: { proforma: 'Proforma faktura', confirmation: 'Potvrzení objednávky' },
                sk: { proforma: 'Proforma faktúra', confirmation: 'Potvrdenie objednávky' },
                sv: { proforma: 'Proformafaktura', confirmation: 'Orderbekräftelse' },
                sr: { proforma: 'Predračun', confirmation: 'Potvrda porudžbine' },
            }
            const subj = subjectLabels[orderLanguage] || { proforma: 'Proforma Invoice', confirmation: 'Order Confirmation' }
            let finalSubject = isProformaFlow
                ? `${subj.proforma} — #${order.order_number}`
                : `${subj.confirmation} — #${order.order_number}`

            // Try DB template first, fall back to code-generated email
            const dbHtml = await renderDatabaseTemplate(documentType, emailData, orderLanguage)
            let finalHtml = ''
            const isPickupOrder = mode === 'pickup'
            const isExportOrder = orderPayload.transaction_type === 'export'

            if (dbHtml) {
                finalHtml = dbHtml
                const insertBeforeBody = (html: string, block: string) =>
                    html.includes('</body>') ? html.replace('</body>', `${block}</body>`) : html + block

                // Low stock notice (pickup order not auto-confirmed)
                if (isPickupOrder && !autoConfirmed) {
                    const lsLabels: Record<string, { title: string; body: string }> = {
                        en: { title: 'Stock Verification Required', body: 'Some items in your order have limited availability. Our team will verify stock and send you a confirmation email within 24 hours.' },
                        sl: { title: 'Potrebna preverba zalog', body: 'Nekateri artikli vašega naročila imajo omejeno razpoložljivost. Naša ekipa bo preverila zaloge in vam v 24 urah poslala potrditveno e-pošto.' },
                        de: { title: 'Lagerbestandsprüfung erforderlich', body: 'Einige Artikel Ihrer Bestellung haben eine begrenzte Verfügbarkeit. Unser Team wird den Bestand prüfen und Ihnen innerhalb von 24 Stunden eine Bestätigung senden.' },
                        hr: { title: 'Potrebna provjera zaliha', body: 'Neki artikli iz vaše narudžbe imaju ograničenu dostupnost. Naš tim će provjeriti zalihe i poslati vam potvrdu e-poštom u roku od 24 sata.' },
                        it: { title: 'Verifica disponibilità richiesta', body: 'Alcuni articoli del tuo ordine hanno disponibilità limitata. Il nostro team verificherà la disponibilità e ti invierà un\'e-mail di conferma entro 24 ore.' },
                        cs: { title: 'Vyžadováno ověření skladu', body: 'Některé položky vaší objednávky mají omezenou dostupnost. Náš tým ověří dostupnost a do 24 hodin vám zašle potvrzovací e-mail.' },
                        sk: { title: 'Vyžadované overenie skladu', body: 'Niektoré položky vašej objednávky majú obmedzenú dostupnosť. Náš tím overí dostupnosť a do 24 hodín vám zašle potvrdzovací e-mail.' },
                        sv: { title: 'Lagerverifiering krävs', body: 'Vissa artiklar i din beställning har begränsad tillgänglighet. Vårt team kommer att verifiera lagerstatus och skicka dig en bekräftelse via e-post inom 24 timmar.' },
                    }
                    const ls = lsLabels[orderLanguage] || lsLabels.en
                    finalHtml = insertBeforeBody(finalHtml, `<div style="background:#fff7ed;border:1px solid #f97316;border-radius:8px;padding:16px;margin:24px 32px"><p style="font-size:14px;font-weight:700;color:#9a3412;margin:0 0 8px">⏳ ${ls.title}</p><p style="font-size:13px;color:#9a3412;margin:0;line-height:1.5">${ls.body}</p></div>`)
                }

                // Payment proof required (pickup, non-net30)
                if (pickupPaymentProofRequired) {
                    const ppLabels: Record<string, { title: string; body: string }> = {
                        en: { title: 'Payment Required Before Pickup', body: 'You must present proof of payment (bank transfer confirmation) to our warehouse staff before items will be released. Items will NOT be handed over without verified proof of payment.' },
                        sl: { title: 'Plačilo obvezno pred prevzemom', body: 'Pred prevzemom blaga morate skladiščnemu osebju predložiti dokazilo o plačilu (potrdilo o bančnem nakazilu). Brez preverjenega dokazila o plačilu blago NE bo izdano.' },
                        de: { title: 'Zahlung vor Abholung erforderlich', body: 'Sie müssen dem Lagerpersonal einen Zahlungsnachweis (Banküberweisung) vorlegen, bevor die Ware ausgehändigt wird. Ohne verifizierten Zahlungsnachweis werden keine Artikel herausgegeben.' },
                        hr: { title: 'Plaćanje obvezno prije preuzimanja', body: 'Morate predočiti dokaz o plaćanju (potvrdu bankovnog prijenosa) skladišnom osoblju prije preuzimanja robe. Roba NEĆE biti izdana bez verificiranog dokaza o plaćanju.' },
                        it: { title: 'Pagamento richiesto prima del ritiro', body: 'È necessario presentare una prova di pagamento (conferma di bonifico bancario) al personale del magazzino prima del rilascio della merce. Nessun articolo verrà consegnato senza prova di pagamento verificata.' },
                        cs: { title: 'Platba vyžadována před vyzvednutím', body: 'Před vydáním zboží musíte skladovému personálu předložit doklad o platbě (potvrzení bankovního převodu). Bez ověřeného dokladu o platbě zboží NEBUDE vydáno.' },
                        sk: { title: 'Platba vyžadovaná pred vyzdvihnutím', body: 'Pred vydaním tovaru musíte skladovému personálu predložiť doklad o platbe (potvrdenie bankového prevodu). Bez overeného dokladu o platbe tovar NEBUDE vydaný.' },
                        sv: { title: 'Betalning krävs före upphämtning', body: 'Du måste visa betalningsbevis (bekräftelse på banköverföring) till vår lagerpersonal innan varor lämnas ut. Varor kommer INTE att lämnas ut utan verifierat betalningsbevis.' },
                    }
                    const pp = ppLabels[orderLanguage] || ppLabels.en
                    finalHtml = insertBeforeBody(finalHtml, `<div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px;margin:24px 32px"><p style="font-size:14px;font-weight:700;color:#dc2626;margin:0 0 8px">🚨 ${pp.title}</p><p style="font-size:13px;color:#991b1b;margin:0;line-height:1.5">${pp.body}</p></div>`)
                }

                // Customs disclaimer for export orders
                if (isExportOrder) {
                    const customsLabels: Record<string, { title: string; body: string }> = {
                        en: { title: 'Important: Customs & Import Duties', body: 'This order is shipping outside the European Union. Customs duties, import taxes, and other fees are NOT included in the order total and are the sole responsibility of the buyer.' },
                        sl: { title: 'Pomembno: Carinske dajatve in uvozne takse', body: 'To naročilo se pošilja izven Evropske unije. Carinske dajatve, uvozni davki in druge pristojbine NISO vključene v skupni znesek naročila in so izključno odgovornost kupca.' },
                        de: { title: 'Wichtig: Zölle & Einfuhrabgaben', body: 'Diese Bestellung wird außerhalb der Europäischen Union versendet. Zölle, Einfuhrsteuern und sonstige Gebühren sind NICHT im Bestellbetrag enthalten und liegen in der alleinigen Verantwortung des Käufers.' },
                        hr: { title: 'Važno: Carine i uvozne pristojbe', body: 'Ova narudžba se šalje izvan Europske unije. Carine, uvozni porezi i druge pristojbe NISU uključeni u ukupni iznos narudžbe i isključiva su odgovornost kupca.' },
                        it: { title: 'Importante: Dazi doganali e tasse di importazione', body: 'Questo ordine viene spedito al di fuori dell\'Unione Europea. Dazi doganali, tasse di importazione e altri oneri NON sono inclusi nel totale dell\'ordine e sono a carico esclusivo dell\'acquirente.' },
                        cs: { title: 'Důležité: Cla a dovozní poplatky', body: 'Tato objednávka je zasílána mimo Evropskou unii. Cla, dovozní daně a další poplatky NEJSOU zahrnuty v celkové částce objednávky a jsou výhradní odpovědností kupujícího.' },
                        sk: { title: 'Dôležité: Clá a dovozné poplatky', body: 'Táto objednávka je zasielaná mimo Európsku úniu. Clá, dovozné dane a ďalšie poplatky NIE SÚ zahrnuté v celkovej sume objednávky a sú výhradnou zodpovednosťou kupujúceho.' },
                        sv: { title: 'Viktigt: Tullavgifter och importskatter', body: 'Denna beställning skickas utanför Europeiska unionen. Tullavgifter, importskatter och andra avgifter INGÅR INTE i ordertotalen och är köparens enskilda ansvar.' },
                    }
                    const cl = customsLabels[orderLanguage] || customsLabels.en
                    finalHtml = insertBeforeBody(finalHtml, `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:24px 32px"><p style="font-size:14px;font-weight:700;color:#92400e;margin:0 0 8px">⚠️ ${cl.title}</p><p style="font-size:13px;color:#92400e;margin:0;line-height:1.5">${cl.body}</p></div>`)
                }
            } else {
                const fallback = buildOrderConfirmationEmail({
                    orderNumber: order.order_number,
                    customerName,
                    email: orderPayload.customer_email,
                    items: orderItemsData.map(i => ({
                        name: i.product_name,
                        sku: i.sku,
                        quantity: i.quantity,
                        unitPrice: i.unit_price,
                        totalPrice: i.total_price,
                    })),
                    subtotal,
                    shippingCost,
                    vatAmount,
                    total: grandTotal,
                    currency: 'EUR',
                    shippingAddress: orderPayload.shipping_address as any,
                    paymentMethod: orderPayload.payment_method,
                    language: orderLanguage,
                    isExport: orderPayload.transaction_type === 'export',
                    isLowStock: isPickupOrder && !autoConfirmed,
                    pickupPaymentProofRequired,
                })
                finalHtml = fallback.html
                finalSubject = fallback.subject
            }

            await sendEmail({
                from: 'Tigo Energy Shop <support@tigoenergy.shop>',
                to: orderPayload.customer_email,
                subject: finalSubject,
                html: finalHtml,
                orderId: order.id,
                emailType: 'order_confirmation',
            })
        } catch (emailErr) {
            console.error('Failed to send quick order confirmation email:', emailErr)
        }

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
