import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { calculateTigoParcels } from '@/lib/shipping/dpd'

// Returns dd.mm.yyyy string for the next weekday (skips Sat/Sun).
function nextWeekday(): string {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}.${mm}.${d.getFullYear()}`
}

const DPD_PICKUP_TO = 'easyship@dpd.si'
const DPD_PICKUP_CC = ['milan.cunjak@initra.com', 'dejan.obradovic@adriapower.com']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = await params
    const { email, delivery_id: deliveryId } = await req.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const supabase = await createAdminClient()

    const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, email, phone')
        .eq('email', email)
        .eq('is_warehouse', true)
        .single()
    if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get current warehouse_actions + order details for customer email
    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions, order_number, customer_email, shipping_address, shipping_carrier, language, pickup_payment_proof_required')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const newAction = {
        action: 'marked_prepared',
        by_email: driver.email,
        by_name: driver.name,
        at: new Date().toISOString(),
    }

    // Split-delivery card → mark this delivery prepared (status + audit log)
    if (deliveryId) {
        const { data: delivery } = await supabase
            .from('order_deliveries')
            .select('warehouse_actions')
            .eq('id', deliveryId)
            .eq('order_id', orderId)
            .single()
        if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
        const dActions = Array.isArray(delivery.warehouse_actions) ? delivery.warehouse_actions : []
        dActions.push(newAction)
        const { error: dErr } = await supabase
            .from('order_deliveries')
            .update({ warehouse_actions: dActions, status: 'prepared', prepared_at: new Date().toISOString() })
            .eq('id', deliveryId)
        if (dErr) return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 })
    } else {
        const actions = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
        actions.push(newAction)
        const { error } = await supabase
            .from('orders')
            .update({ warehouse_actions: actions })
            .eq('id', orderId)

        if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    // ── DPD pickup carorder email ─────────────────────────────────────────
    // When a DPD card is marked prepared, email easyship@dpd.si so they
    // schedule the pickup. Resolve which items belong to this card.
    let dpdItems: { sku: string; name: string; quantity: number; weight_kg: number | null }[] = []
    let isDpdContext = false
    if (deliveryId) {
        const { data: delivery } = await supabase
            .from('order_deliveries')
            .select('carrier, items, warehouse_actions')
            .eq('id', deliveryId)
            .single()
        if (delivery?.carrier === 'DPD') {
            isDpdContext = true
            const dItems = typeof delivery.items === 'string' ? JSON.parse(delivery.items) : (delivery.items || [])
            const qtyById = new Map<string, number>(dItems.map((d: any) => [d.order_item_id, Number(d.qty)]))
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('id, sku, product_name, quantity, weight_kg')
                .eq('order_id', orderId)
            dpdItems = (orderItems || [])
                .filter(it => qtyById.has(it.id))
                .map(it => ({ sku: it.sku, name: it.product_name, quantity: qtyById.get(it.id)!, weight_kg: it.weight_kg }))
            // Self-dedupe: if this delivery already has the email-sent stamp,
            // it's a toggle/undo cycle — don't re-trigger anything.
            const dActions = Array.isArray(delivery.warehouse_actions) ? delivery.warehouse_actions : []
            if (dActions.some((a: any) => a.action === 'dpd_carorder_email_sent' || a.action === 'dpd_carorder_deferred')) isDpdContext = false
        }
    } else if (order.shipping_carrier === 'DPD') {
        isDpdContext = true
        const { data: orderItems } = await supabase
            .from('order_items')
            .select('id, sku, product_name, quantity, weight_kg, shipping_carrier')
            .eq('order_id', orderId)
        dpdItems = (orderItems || [])
            .filter(it => !it.shipping_carrier || it.shipping_carrier === 'DPD')
            .map(it => ({ sku: it.sku, name: it.product_name, quantity: it.quantity, weight_kg: it.weight_kg }))
        const existing = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
        if (existing.some((a: any) => a.action === 'dpd_carorder_email_sent' || a.action === 'dpd_carorder_deferred')) isDpdContext = false
        if (dpdItems.length === 0) isDpdContext = false
    }

    if (isDpdContext && dpdItems.length > 0) {
        // Cross-order dedupe: if any other DPD card already triggered a
        // carorder that hasn't been picked up yet, the driver is already on
        // the way — they'll grab this one too. Stamp 'deferred' instead.
        let driverAlreadyComing = false
        const { data: pendingDeliveries } = await supabase
            .from('order_deliveries')
            .select('id, warehouse_actions')
            .eq('carrier', 'DPD')
            .neq('status', 'completed')
        for (const d of pendingDeliveries || []) {
            if (deliveryId && d.id === deliveryId) continue
            const acts = Array.isArray(d.warehouse_actions) ? d.warehouse_actions : []
            if (acts.some((a: any) => a.action === 'dpd_carorder_email_sent')) { driverAlreadyComing = true; break }
        }
        if (!driverAlreadyComing) {
            const { data: pendingOrders } = await supabase
                .from('orders')
                .select('id, warehouse_actions')
                .eq('shipping_carrier', 'DPD')
                .eq('status', 'processing')
            for (const o of pendingOrders || []) {
                if (!deliveryId && o.id === orderId) continue
                const acts = Array.isArray(o.warehouse_actions) ? o.warehouse_actions : []
                const emailSent = acts.some((a: any) => a.action === 'dpd_carorder_email_sent')
                const pickedUp = acts.some((a: any) => a.action === 'marked_dpd_picked_up')
                if (emailSent && !pickedUp) { driverAlreadyComing = true; break }
            }
        }

        const parcels = calculateTigoParcels(dpdItems.map(i => ({
            sku: i.sku, name: i.name, quantity: i.quantity, weight_kg: i.weight_kg || 0,
        })))
        const parcelCount = parcels.length
        const totalWeight = parcels.reduce((s, p) => s + p.weight, 0)
        const pickupDate = nextWeekday()

        let stampAction: any
        if (driverAlreadyComing) {
            stampAction = {
                action: 'dpd_carorder_deferred',
                by_email: driver.email,
                by_name: driver.name,
                at: new Date().toISOString(),
                reason: 'driver already pending pickup from earlier DPD order',
                parcel_count: parcelCount,
                total_weight_kg: Number(totalWeight.toFixed(2)),
            }
        } else {
            try {
                const subject = 'narocilo carorder Initra'
                const bodyText = [
                    'Narocamo carorder na Initri.',
                    '',
                    'Prevzem na:',
                    '1356 Dobrova',
                    'Podsmreka 59A',
                    'Initra d.o.o.',
                    'Kontakt: Mile 051-766-308 milan.cunjak@initra.com',
                    '',
                    `Datum prevzema: ${pickupDate}`,
                    `Stevilo paketov: ${parcelCount}`,
                    `Priblizna teza: ${totalWeight.toFixed(2)} kg`,
                ].join('\n')
                const html = `<pre style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;white-space:pre-wrap;line-height:1.6">${bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
                await sendEmail({
                    from: 'Initra Energija <support@tigoenergy.shop>',
                    to: DPD_PICKUP_TO,
                    cc: DPD_PICKUP_CC,
                    subject,
                    html,
                    skipUnsubscribe: true,
                    orderId,
                    emailType: 'dpd_carorder',
                }).catch(err => console.error(`Failed dpd carorder email:`, err))
            } catch (carorderErr) {
                console.error('Failed to send DPD carorder email (non-fatal):', carorderErr)
            }
            stampAction = {
                action: 'dpd_carorder_email_sent',
                by_email: driver.email,
                by_name: driver.name,
                at: new Date().toISOString(),
                pickup_date: pickupDate,
                parcel_count: parcelCount,
                total_weight_kg: Number(totalWeight.toFixed(2)),
            }
        }

        // Stamp the audit log on the right row so we never re-evaluate this card
        if (deliveryId) {
            const { data: d } = await supabase
                .from('order_deliveries')
                .select('warehouse_actions')
                .eq('id', deliveryId).single()
            const acts = Array.isArray(d?.warehouse_actions) ? [...d!.warehouse_actions, stampAction] : [stampAction]
            await supabase.from('order_deliveries').update({ warehouse_actions: acts }).eq('id', deliveryId)
        } else {
            const { data: oRow } = await supabase
                .from('orders')
                .select('warehouse_actions')
                .eq('id', orderId).single()
            const acts = Array.isArray(oRow?.warehouse_actions) ? [...oRow!.warehouse_actions, stampAction] : [stampAction]
            await supabase.from('orders').update({ warehouse_actions: acts }).eq('id', orderId)
        }
    }

    // Notify customer: order is ready for pickup
    const isPickup = order.shipping_carrier === 'Personal Pick-up'
    if (isPickup && order.customer_email) {
        try {
            const lang = order.language || 'en'
            const addr = order.shipping_address
            const customerName = addr ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim() : ''
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'

            // Only Slovenian customers can pick up locally
            const l = {
                subject: `Naročilo #${order.order_number} je pripravljeno za prevzem`,
                greeting: `Pozdravljeni${customerName ? ` ${customerName}` : ''},`,
                heading: 'Vaše naročilo je pripravljeno za prevzem!',
                body: 'Vaše naročilo je pripravljeno in vas čaka na spodnjem naslovu. Prosimo, da se pred prihodom najavite po telefonu ali e-pošti.',
                address: 'Naslov za prevzem',
                contact: 'Kontakt skladišča',
            }

            const paymentProofHtml = order.pickup_payment_proof_required
                ? `<div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:14px;margin:16px 0;">
                    <p style="font-size:14px;font-weight:700;color:#dc2626;margin:0 0 8px;">Plačilo obvezno pred prevzemom</p>
                    <p style="font-size:13px;color:#991b1b;margin:0;line-height:1.5;">Pred prevzemom blaga morate skladiščnemu osebju predložiti dokazilo o plačilu (potrdilo o bančnem nakazilu). Brez preverjenega dokazila o plačilu blago NE bo izdano.</p>
                   </div>`
                : ''

            const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#f9fafb;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#16a34a;padding:24px 32px;color:#fff;">
    <img src="${siteUrl}/initra-logo.png" alt="Tigo" style="height:24px;margin-bottom:8px;">
    <h1 style="font-size:20px;font-weight:300;margin:0;">${l.heading}</h1>
  </div>
  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:14px;">${l.greeting}</p>
    <p style="color:#374151;font-size:14px;">${l.body}</p>
    ${paymentProofHtml}
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;">${l.address}</p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111;">Initra d.o.o., Podsmreka 59A, 1356 Dobrova, Slovenija</p>
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;">${l.contact}</p>
      <p style="margin:0;font-size:14px;color:#111;font-weight:600;">${driver.name}</p>
      ${driver.phone ? `<p style="margin:2px 0;font-size:13px;color:#374151;">${driver.phone}</p>` : ''}
      <p style="margin:2px 0;font-size:13px;color:#374151;">${driver.email}</p>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">#${order.order_number}</p>
    </div>
    <p style="color:#9ca3af;font-size:11px;margin-top:24px;text-align:center;">Initra Energija d.o.o.</p>
  </div>
</div></body></html>`

            await sendEmail({
                from: 'Initra Energija <support@tigoenergy.shop>',
                to: order.customer_email,
                subject: l.subject,
                html,
                orderId,
                emailType: 'order_ready_pickup',
            })
        } catch (emailErr) {
            console.error('Failed to send pickup-ready email (non-fatal):', emailErr)
        }
    }

    return NextResponse.json({ success: true })
}
