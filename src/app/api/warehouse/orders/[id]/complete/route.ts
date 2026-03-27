import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = await params
    const { email, type } = await req.json()
    if (!email || !type) return NextResponse.json({ error: 'Missing email or type' }, { status: 400 })

    const supabase = await createAdminClient()

    const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, email, phone')
        .eq('email', email)
        .eq('is_warehouse', true)
        .single()
    if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Append to warehouse_actions
    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions, pickup_payment_proof_required, invoice_number, order_number, customer_email, shipping_address, language, payment_terms, payment_due_date, customer_id')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
    const action = type === 'pickup' ? 'marked_picked_up' : 'marked_dpd_picked_up'
    actions.push({
        action,
        by_email: driver.email,
        by_name: driver.name,
        at: new Date().toISOString(),
    })

    // Pickup = customer already has it → delivered. DPD = shipped (in transit).
    const now = new Date().toISOString()
    const statusUpdate: Record<string, any> = type === 'pickup'
        ? { status: 'delivered', delivered_at: now, warehouse_actions: actions }
        : { status: 'shipped', shipped_at: now, warehouse_actions: actions }

    // For net pickup orders: set payment_due_date starting from delivery
    if (type === 'pickup' && order.payment_terms === 'net30' && !order.payment_due_date) {
        let days = 30
        if (order.customer_id) {
            const { data: customer } = await supabase
                .from('customers')
                .select('payment_terms_days')
                .eq('id', order.customer_id)
                .single()
            if (customer?.payment_terms_days) days = customer.payment_terms_days
        }
        const dueDate = new Date(now)
        dueDate.setDate(dueDate.getDate() + days)
        statusUpdate.payment_due_date = dueDate.toISOString().split('T')[0]
    }

    const { error } = await supabase
        .from('orders')
        .update(statusUpdate)
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

    // Auto-issue invoice for pickup orders when payment has been verified
    // (DPD orders wait for delivery confirmation — no auto-invoice)
    let invoiceIssued = false
    if (type === 'pickup' && !order.invoice_number) {
        const hasPaymentVerified = actions.some((a: any) => a.action === 'payment_verified')
        // Auto-invoice if: payment was verified OR order doesn't require payment proof (net30)
        if (hasPaymentVerified || !order.pickup_payment_proof_required) {
            try {
                const { issueOrderInvoiceAction, adminSendInvoiceEmailAction } = await import('@/app/actions/admin')
                await issueOrderInvoiceAction(orderId, { skipAdminCheck: true })
                await adminSendInvoiceEmailAction(orderId, { skipAdminCheck: true })
                invoiceIssued = true
            } catch (invoiceErr) {
                console.error('Auto-invoice failed (non-fatal):', invoiceErr)
            }
        }
    }

    // Notify customer about order completion
    if (order.customer_email) {
        try {
            const lang = order.language || 'en'
            const addr = order.shipping_address
            const customerName = addr ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim() : ''
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'

            if (type === 'pickup') {
                // Pickup completed — thank you email
                // Only Slovenian customers can pick up locally
                const l = {
                    subject: `Naročilo #${order.order_number} — uspešno prevzeto`,
                    greeting: `Pozdravljeni${customerName ? ` ${customerName}` : ''},`,
                    heading: 'Naročilo uspešno prevzeto!',
                    body: 'Vaše naročilo je bilo uspešno prevzeto v našem skladišču. Hvala za vaš nakup!',
                    thanks: 'Če imate kakršna koli vprašanja, nas kontaktirajte na support@tigoenergy.shop.',
                }

                const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#f9fafb;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#16a34a;padding:24px 32px;color:#fff;">
    <img src="${siteUrl}/initra-logo.png" alt="Tigo" style="height:24px;margin-bottom:8px;">
    <h1 style="font-size:20px;font-weight:300;margin:0;">${l.heading}</h1>
  </div>
  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:14px;">${l.greeting}</p>
    <p style="color:#374151;font-size:14px;">${l.body}</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">#${order.order_number}</p>
    </div>
    <p style="color:#6b7280;font-size:12px;">${l.thanks}</p>
    <p style="color:#9ca3af;font-size:11px;margin-top:24px;text-align:center;">Initra Energija d.o.o.</p>
  </div>
</div></body></html>`

                await sendEmail({
                    from: 'Initra Energija <support@tigoenergy.shop>',
                    to: order.customer_email,
                    subject: l.subject,
                    html,
                    orderId,
                    emailType: 'order_picked_up',
                })
            } else {
                // DPD shipped — notify customer
                const labels: Record<string, { subject: string; greeting: string; heading: string; body: string; note: string }> = {
                    sl: {
                        subject: `Naročilo #${order.order_number} — odposlano z DPD`,
                        greeting: `Pozdravljeni${customerName ? ` ${customerName}` : ''},`,
                        heading: 'Vaše naročilo je na poti!',
                        body: 'Vaše naročilo je bilo predano kurirju DPD in je na poti do vas.',
                        note: 'Podatke za sledenje pošiljke boste prejeli ločeno od DPD.',
                    },
                    en: {
                        subject: `Order #${order.order_number} — shipped via DPD`,
                        greeting: `Hello${customerName ? ` ${customerName}` : ''},`,
                        heading: 'Your order is on its way!',
                        body: 'Your order has been handed over to DPD courier and is on its way to you.',
                        note: 'You will receive tracking information separately from DPD.',
                    },
                    de: {
                        subject: `Bestellung #${order.order_number} — per DPD versendet`,
                        greeting: `Hallo${customerName ? ` ${customerName}` : ''},`,
                        heading: 'Ihre Bestellung ist unterwegs!',
                        body: 'Ihre Bestellung wurde dem DPD-Kurier übergeben und ist auf dem Weg zu Ihnen.',
                        note: 'Sendungsverfolgungsinformationen erhalten Sie separat von DPD.',
                    },
                    hr: {
                        subject: `Narudžba #${order.order_number} — poslana putem DPD`,
                        greeting: `Pozdrav${customerName ? ` ${customerName}` : ''},`,
                        heading: 'Vaša narudžba je na putu!',
                        body: 'Vaša narudžba je predana DPD kuriru i na putu je do vas.',
                        note: 'Informacije o praćenju pošiljke primit ćete zasebno od DPD-a.',
                    },
                    it: {
                        subject: `Ordine #${order.order_number} — spedito tramite DPD`,
                        greeting: `Ciao${customerName ? ` ${customerName}` : ''},`,
                        heading: 'Il tuo ordine è in viaggio!',
                        body: 'Il tuo ordine è stato consegnato al corriere DPD ed è in viaggio verso di te.',
                        note: 'Riceverai le informazioni di tracciamento separatamente da DPD.',
                    },
                    cs: {
                        subject: `Objednávka #${order.order_number} — odesláno přes DPD`,
                        greeting: `Dobrý den${customerName ? ` ${customerName}` : ''},`,
                        heading: 'Vaše objednávka je na cestě!',
                        body: 'Vaše objednávka byla předána kurýrovi DPD a je na cestě k vám.',
                        note: 'Informace o sledování zásilky obdržíte samostatně od DPD.',
                    },
                    sk: {
                        subject: `Objednávka #${order.order_number} — odoslaná cez DPD`,
                        greeting: `Dobrý deň${customerName ? ` ${customerName}` : ''},`,
                        heading: 'Vaša objednávka je na ceste!',
                        body: 'Vaša objednávka bola odovzdaná kuriérovi DPD a je na ceste k vám.',
                        note: 'Informácie o sledovaní zásielky dostanete samostatne od DPD.',
                    },
                    sv: {
                        subject: `Beställning #${order.order_number} — skickad med DPD`,
                        greeting: `Hej${customerName ? ` ${customerName}` : ''},`,
                        heading: 'Din beställning är på väg!',
                        body: 'Din beställning har lämnats till DPD-kuriren och är på väg till dig.',
                        note: 'Du får spårningsinformation separat från DPD.',
                    },
                }
                const l = labels[lang] || labels.en
                const shippingAddr = addr
                    ? `${addr.street || ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
                    : ''

                const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#f9fafb;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#2563eb;padding:24px 32px;color:#fff;">
    <img src="${siteUrl}/initra-logo.png" alt="Tigo" style="height:24px;margin-bottom:8px;">
    <h1 style="font-size:20px;font-weight:300;margin:0;">${l.heading}</h1>
  </div>
  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:14px;">${l.greeting}</p>
    <p style="color:#374151;font-size:14px;">${l.body}</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;">#${order.order_number}</p>
      ${shippingAddr ? `<p style="margin:4px 0 0;font-size:13px;color:#374151;">${shippingAddr}</p>` : ''}
    </div>
    <p style="color:#6b7280;font-size:12px;font-style:italic;">${l.note}</p>
    <p style="color:#9ca3af;font-size:11px;margin-top:24px;text-align:center;">Initra Energija d.o.o.</p>
  </div>
</div></body></html>`

                await sendEmail({
                    from: 'Initra Energija <support@tigoenergy.shop>',
                    to: order.customer_email,
                    subject: l.subject,
                    html,
                    orderId,
                    emailType: 'order_shipped',
                })
            }
        } catch (emailErr) {
            console.error('Failed to send order completion email (non-fatal):', emailErr)
        }
    }

    return NextResponse.json({ success: true, invoiceIssued })
}
