import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

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
