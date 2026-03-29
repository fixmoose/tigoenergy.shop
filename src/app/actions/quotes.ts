'use server'

import { randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate, notifyAdmins } from '@/lib/email'
import { MARKETS, getDomainForMarket } from '@/lib/constants/markets'

async function checkIsAdmin() {
    const cookieStore = await cookies()
    return cookieStore.get('tigo-admin')?.value === '1'
}

// ─── Create Quote ───────────────────────────────────────────────────────────

export async function adminCreateQuoteAction(payload: {
    customer: {
        id?: string
        email: string
        first_name: string
        last_name: string
        company_name?: string
        vat_id?: string
        phone?: string
        is_b2b?: boolean
    }
    quote: {
        market: string
        language?: string
        shipping_cost: number
        vat_rate: number
        items: {
            product_id: string
            product_name: string
            sku: string
            quantity: number
            unit_price: number
            weight_kg?: number
        }[]
        shipping_address?: {
            street: string
            city: string
            postal_code: string
            country: string
            street2?: string
        }
        billing_address?: {
            street: string
            city: string
            postal_code: string
            country: string
            street2?: string
        }
        internal_notes?: string
        expires_days?: number
    }
    sendImmediately?: boolean
}) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()
        const { customer, quote } = payload

        // Find customer ID
        let customerId: string | null = customer.id || null
        if (!customerId) {
            const { data: existing } = await supabase
                .from('customers')
                .select('id')
                .eq('email', customer.email)
                .maybeSingle()
            customerId = existing?.id || null
        }

        // Calculate totals
        const subtotal = quote.items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0)
        const shipCost = parseFloat(quote.shipping_cost as any) || 0
        const vRate = parseFloat(quote.vat_rate as any) || 0
        const vatAmount = (subtotal + shipCost) * (vRate / 100)
        const total = subtotal + shipCost + vatAmount

        const token = randomBytes(32).toString('hex')
        const quoteNumber = `QUO-${Date.now()}`
        const expiresDays = quote.expires_days || 30
        const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()

        // Determine language
        const lang = quote.language || 'en'

        // Get admin email
        const cookieStore = await cookies()
        const adminEmail = cookieStore.get('tigo-admin-email')?.value || 'admin'

        const { data: quoteData, error: quoteError } = await supabase
            .from('quotes')
            .insert({
                quote_number: quoteNumber,
                token,
                customer_id: customerId,
                customer_email: customer.email,
                customer_phone: customer.phone || null,
                company_name: customer.company_name || null,
                vat_id: customer.vat_id || null,
                is_b2b: !!customer.is_b2b,
                shipping_address: quote.shipping_address ? {
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    ...quote.shipping_address,
                } : null,
                billing_address: quote.billing_address ? {
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    ...quote.billing_address,
                } : null,
                subtotal,
                shipping_cost: shipCost,
                vat_rate: vRate,
                vat_amount: vatAmount,
                total,
                market: quote.market || 'si',
                language: lang,
                status: 'draft',
                expires_at: expiresAt,
                internal_notes: quote.internal_notes || null,
                created_by: adminEmail,
            })
            .select()
            .single()

        if (quoteError) throw quoteError

        // Insert items
        const quoteItems = quote.items.map(i => ({
            quote_id: quoteData.id,
            product_id: i.product_id?.startsWith('custom-') ? null : i.product_id,
            sku: i.sku || 'CUSTOM',
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.unit_price * i.quantity,
            weight_kg: i.weight_kg || null,
        }))

        const { error: itemsError } = await supabase.from('quote_items').insert(quoteItems)
        if (itemsError) throw itemsError

        // If sendImmediately, also send the email
        if (payload.sendImmediately) {
            await adminSendQuoteAction(quoteData.id)
        }

        revalidatePath('/admin/quotes')
        return { success: true, quoteId: quoteData.id, quoteNumber, token }
    } catch (err: any) {
        console.error('Error creating quote:', err)
        return { success: false, error: err.message || 'Failed to create quote' }
    }
}

// ─── Send Quote Email ───────────────────────────────────────────────────────

export async function adminSendQuoteAction(quoteId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')

        const supabase = await createAdminClient()

        // Load quote + items
        const { data: quote, error: qErr } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', quoteId)
            .single()

        if (qErr || !quote) throw new Error('Quote not found')

        const { data: items } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', quoteId)
            .order('created_at', { ascending: true })

        // Build accept URL
        const country = quote.shipping_address?.country || quote.market?.toUpperCase() || 'SI'
        const domain = getDomainForMarket(country)
        const acceptUrl = `https://${domain}/quote/${quote.token}`

        // Build items HTML for the email
        const { generateItemsTableHtml } = await import('@/lib/document-service')
        const itemsHtml = generateItemsTableHtml(items || [], '€', true)

        const locale = quote.language || 'en'
        const totalFormatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(quote.total)
        const expiresFormatted = new Date(quote.expires_at).toLocaleDateString(locale === 'sl' ? 'sl-SI' : locale === 'hr' ? 'hr-HR' : locale === 'de' ? 'de-DE' : 'en-GB')

        const customerName = [
            quote.shipping_address?.first_name || quote.company_name || '',
            quote.shipping_address?.last_name || ''
        ].filter(Boolean).join(' ') || quote.customer_email

        const html = await renderTemplate('quote', {
            name: customerName,
            quote_number: quote.quote_number,
            quote_date: new Date(quote.created_at).toLocaleDateString(locale === 'sl' ? 'sl-SI' : locale === 'hr' ? 'hr-HR' : locale === 'de' ? 'de-DE' : 'en-GB'),
            expires_date: expiresFormatted,
            total_amount: totalFormatted,
            order_items: itemsHtml,
            accept_url: acceptUrl,
        }, locale)

        const subjectMap: Record<string, string> = {
            sl: `Ponudba ${quote.quote_number}`,
            hr: `Ponuda ${quote.quote_number}`,
            de: `Angebot ${quote.quote_number}`,
        }

        await sendEmail({
            to: quote.customer_email,
            subject: subjectMap[locale] || `Quote ${quote.quote_number}`,
            html,
            emailType: 'quote',
        })

        // Update status to sent
        await supabase.from('quotes').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq('id', quoteId)

        revalidatePath('/admin/quotes')
        return { success: true }
    } catch (err: any) {
        console.error('Error sending quote:', err)
        return { success: false, error: err.message || 'Failed to send quote' }
    }
}

// ─── List Quotes ────────────────────────────────────────────────────────────

export async function listQuotesAction() {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        const supabase = await createAdminClient()

        const { data, error } = await supabase
            .from('quotes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200)

        if (error) throw error
        return { success: true, data: data || [] }
    } catch (err: any) {
        return { success: false, error: err.message, data: [] }
    }
}

// ─── Get Quote with Items ───────────────────────────────────────────────────

export async function getQuoteAction(quoteId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        const supabase = await createAdminClient()

        const { data: quote, error } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', quoteId)
            .single()

        if (error) throw error

        const { data: items } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', quoteId)
            .order('created_at', { ascending: true })

        return { success: true, data: { ...quote, items: items || [] } }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Get Quote by Token (public) ────────────────────────────────────────────

export async function getQuoteByTokenAction(token: string) {
    try {
        const supabase = await createAdminClient()

        const { data: quote, error } = await supabase
            .from('quotes')
            .select('*')
            .eq('token', token)
            .single()

        if (error || !quote) return { success: false, error: 'Quote not found' }

        // Check expiry
        if (new Date(quote.expires_at) < new Date() && quote.status !== 'accepted') {
            if (quote.status === 'sent' || quote.status === 'viewed') {
                await supabase.from('quotes').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', quote.id)
            }
            return { success: false, error: 'This quote has expired' }
        }

        // Mark as viewed if first time
        if (quote.status === 'sent') {
            await supabase.from('quotes').update({
                status: 'viewed',
                viewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', quote.id)
            quote.status = 'viewed'
        }

        const { data: items } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', quote.id)
            .order('created_at', { ascending: true })

        return { success: true, data: { ...quote, items: items || [] } }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Accept Quote → Convert to Order ────────────────────────────────────────

export async function acceptQuoteAction(token: string, delivery: {
    type: 'shipping' | 'pickup'
    address?: {
        street: string
        city: string
        postal_code: string
        country: string
        street2?: string
    }
}) {
    try {
        const supabase = await createAdminClient()

        const { data: quote, error: qErr } = await supabase
            .from('quotes')
            .select('*')
            .eq('token', token)
            .single()

        if (qErr || !quote) return { success: false, error: 'Quote not found' }

        // Validate status
        if (!['sent', 'viewed'].includes(quote.status)) {
            return { success: false, error: quote.status === 'accepted' ? 'This quote has already been converted to an order' : 'This quote is no longer valid' }
        }

        // Check expiry
        if (new Date(quote.expires_at) < new Date()) {
            await supabase.from('quotes').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', quote.id)
            return { success: false, error: 'This quote has expired' }
        }

        // Load items
        const { data: items } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', quote.id)

        if (!items || items.length === 0) return { success: false, error: 'Quote has no items' }

        // Determine shipping address
        const isPickup = delivery.type === 'pickup'
        const shippingAddress = isPickup
            ? { first_name: quote.shipping_address?.first_name || '', last_name: quote.shipping_address?.last_name || '', street: 'Pickup in Person', city: 'Podsmreka', postal_code: '1356', country: 'SI' }
            : (delivery.address
                ? { first_name: quote.shipping_address?.first_name || '', last_name: quote.shipping_address?.last_name || '', ...delivery.address }
                : quote.shipping_address)

        if (!shippingAddress) return { success: false, error: 'Shipping address is required for delivery orders' }

        const deliveryCountry = shippingAddress.country || 'SI'

        // Determine transaction type
        const EU_COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
        let transactionType: string = 'export'
        if (deliveryCountry === 'SI') transactionType = 'domestic'
        else if (EU_COUNTRIES.includes(deliveryCountry)) transactionType = 'eu'

        // Recalculate shipping cost for pickup
        const shippingCost = isPickup ? 0 : quote.shipping_cost
        const vatAmount = (quote.subtotal + shippingCost) * (quote.vat_rate / 100)
        const total = quote.subtotal + shippingCost + vatAmount

        // Create the order
        const orderNumber = `QUO-ORD-${Date.now()}`
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_number: orderNumber,
                customer_id: quote.customer_id,
                customer_email: quote.customer_email,
                customer_phone: quote.customer_phone,
                company_name: quote.company_name,
                vat_id: quote.vat_id,
                status: 'pending',
                payment_status: 'unpaid',
                shipping_address: shippingAddress,
                billing_address: quote.billing_address || shippingAddress,
                subtotal: quote.subtotal,
                shipping_cost: shippingCost,
                vat_rate: quote.vat_rate,
                vat_amount: vatAmount,
                total,
                market: quote.market,
                language: quote.language,
                is_b2b: quote.is_b2b || false,
                payment_method: 'IBAN',
                delivery_country: deliveryCountry,
                transaction_type: transactionType,
                internal_notes: isPickup ? 'Pickup in Person (from quote)' : `Created from quote ${quote.quote_number}`,
                created_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (orderError) throw orderError

        // Create order items
        const orderItems = items.map(i => ({
            order_id: orderData.id,
            product_id: i.product_id,
            sku: i.sku,
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.total_price,
        }))

        await supabase.from('order_items').insert(orderItems)

        // Update quote status
        await supabase.from('quotes').update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            order_id: orderData.id,
            shipping_cost: shippingCost,
            vat_amount: vatAmount,
            total,
            updated_at: new Date().toISOString(),
        }).eq('id', quote.id)

        // Send IBAN payment email to customer
        try {
            const { generateItemsTableHtml } = await import('@/lib/document-service')
            const itemsHtml = generateItemsTableHtml(orderItems, '€', true)
            const locale = quote.language || 'en'

            const ibanHtml = await renderTemplate('order-iban-payment', {
                name: shippingAddress.first_name + ' ' + shippingAddress.last_name,
                order_number: orderNumber,
                order_date: new Date().toLocaleDateString('en-GB'),
                total_amount: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(total),
                order_items: itemsHtml,
            }, locale)

            const subjectMap: Record<string, string> = {
                sl: `Naročilo #${orderNumber} — plačilo potrebno`,
                hr: `Narudžba #${orderNumber} — plaćanje potrebno`,
                de: `Bestellung #${orderNumber} — Zahlung erforderlich`,
            }

            await sendEmail({
                to: quote.customer_email,
                subject: subjectMap[locale] || `Order #${orderNumber} — Payment Required`,
                html: ibanHtml,
                orderId: orderData.id,
                emailType: 'payment_request',
            })
        } catch (emailErr) {
            console.error('Failed to send order email after quote acceptance:', emailErr)
        }

        // Notify admins
        try {
            await notifyAdmins({
                subject: `Quote ${quote.quote_number} accepted → Order #${orderNumber}`,
                html: `<p>Customer <strong>${quote.customer_email}</strong> accepted quote <strong>${quote.quote_number}</strong>.</p>
                <p>Delivery: <strong>${isPickup ? 'Pickup' : 'Shipping to ' + deliveryCountry}</strong></p>
                <p>Order total: <strong>€${total.toFixed(2)}</strong></p>
                <p><a href="https://tigoenergy.shop/admin/orders/${orderData.id}">View Order →</a></p>`,
            })
        } catch (e) {
            console.error('Failed to notify admins:', e)
        }

        return { success: true, orderId: orderData.id, orderNumber }
    } catch (err: any) {
        console.error('Error accepting quote:', err)
        return { success: false, error: err.message || 'Failed to convert quote to order' }
    }
}

// ─── Update Quote (edit fields + items) ─────────────────────────────────────

export async function adminUpdateQuoteAction(quoteId: string, payload: {
    customer: {
        id?: string
        email: string
        first_name: string
        last_name: string
        company_name?: string
        vat_id?: string
        phone?: string
        is_b2b?: boolean
    }
    quote: {
        market: string
        language?: string
        shipping_cost: number
        vat_rate: number
        items: {
            product_id: string
            product_name: string
            sku: string
            quantity: number
            unit_price: number
            weight_kg?: number
        }[]
        shipping_address?: {
            street: string
            city: string
            postal_code: string
            country: string
            street2?: string
        }
        billing_address?: {
            street: string
            city: string
            postal_code: string
            country: string
            street2?: string
        }
        internal_notes?: string
        expires_days?: number
    }
}) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        const supabase = await createAdminClient()

        // Only allow editing non-accepted quotes
        const { data: existing } = await supabase.from('quotes').select('status').eq('id', quoteId).single()
        if (!existing) throw new Error('Quote not found')
        if (existing.status === 'accepted') throw new Error('Cannot edit an accepted quote')

        const { customer, quote } = payload

        // Recalculate totals
        const subtotal = quote.items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0)
        const shipCost = parseFloat(quote.shipping_cost as any) || 0
        const vRate = parseFloat(quote.vat_rate as any) || 0
        const vatAmount = (subtotal + shipCost) * (vRate / 100)
        const total = subtotal + shipCost + vatAmount

        const expiresDays = quote.expires_days || 30
        const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()

        // Update quote record
        const { error: updateErr } = await supabase.from('quotes').update({
            customer_email: customer.email,
            customer_phone: customer.phone || null,
            company_name: customer.company_name || null,
            vat_id: customer.vat_id || null,
            is_b2b: !!customer.is_b2b,
            shipping_address: quote.shipping_address ? {
                first_name: customer.first_name,
                last_name: customer.last_name,
                ...quote.shipping_address,
            } : null,
            billing_address: quote.billing_address ? {
                first_name: customer.first_name,
                last_name: customer.last_name,
                ...quote.billing_address,
            } : null,
            subtotal,
            shipping_cost: shipCost,
            vat_rate: vRate,
            vat_amount: vatAmount,
            total,
            market: quote.market || 'si',
            language: quote.language || 'en',
            internal_notes: quote.internal_notes || null,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
        }).eq('id', quoteId)

        if (updateErr) throw updateErr

        // Replace items: delete old, insert new
        await supabase.from('quote_items').delete().eq('quote_id', quoteId)

        const quoteItems = quote.items.map(i => ({
            quote_id: quoteId,
            product_id: i.product_id?.startsWith('custom-') ? null : i.product_id,
            sku: i.sku || 'CUSTOM',
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.unit_price * i.quantity,
            weight_kg: i.weight_kg || null,
        }))

        const { error: itemsErr } = await supabase.from('quote_items').insert(quoteItems)
        if (itemsErr) throw itemsErr

        revalidatePath('/admin/quotes')
        revalidatePath(`/admin/quotes/${quoteId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error updating quote:', err)
        return { success: false, error: err.message || 'Failed to update quote' }
    }
}

// ─── Update Quote Status ────────────────────────────────────────────────────

export async function adminUpdateQuoteStatusAction(quoteId: string, status: 'expired' | 'declined') {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        const supabase = await createAdminClient()

        await supabase.from('quotes').update({
            status,
            updated_at: new Date().toISOString(),
        }).eq('id', quoteId)

        revalidatePath('/admin/quotes')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Delete Draft Quote ─────────────────────────────────────────────────────

export async function adminDeleteQuoteAction(quoteId: string) {
    try {
        if (!await checkIsAdmin()) throw new Error('Unauthorized')
        const supabase = await createAdminClient()

        // Only delete drafts
        const { data: quote } = await supabase.from('quotes').select('status').eq('id', quoteId).single()
        if (quote?.status !== 'draft') return { success: false, error: 'Can only delete draft quotes' }

        await supabase.from('quote_items').delete().eq('quote_id', quoteId)
        await supabase.from('quotes').delete().eq('id', quoteId)

        revalidatePath('/admin/quotes')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
