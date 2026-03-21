import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DPDService } from '@/lib/shipping/dpd'
import { sendEmail, renderTemplate } from '@/lib/email'
import { revalidatePath } from 'next/cache'

/**
 * Cron job: polls DPD for delivery status on shipped orders.
 * When a parcel is delivered → marks order delivered, sends email, and auto-issues invoice.
 *
 * Trigger via: GET /api/cron/dpd-tracking with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()
    const dpd = new DPDService()

    // Find all shipped DPD orders that haven't been delivered yet
    const { data: shippedOrders, error } = await supabase
        .from('orders')
        .select('id, order_number, tracking_number, customer_email, shipping_address, language, invoice_number')
        .eq('status', 'shipped')
        .eq('shipping_carrier', 'DPD')
        .not('tracking_number', 'is', null)

    if (error) {
        console.error('DPD tracking cron error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let delivered = 0
    let invoiced = 0
    let checked = 0
    let failed = 0

    for (const order of shippedOrders ?? []) {
        checked++
        try {
            // Parse tracking numbers (may be comma-separated for multi-parcel)
            const parcelNumbers = order.tracking_number.split(',').map((n: string) => n.trim()).filter(Boolean)
            if (parcelNumbers.length === 0) continue

            const statuses = await dpd.getParcelStatus(parcelNumbers)

            // Check if ALL parcels are delivered
            const allDelivered = statuses.length > 0 && statuses.every(s => {
                const st = (s.status || '').toUpperCase()
                return st === 'DELIVERED' || st.includes('DELIVER') || st.includes('DOSTAVLJENO')
            })

            if (!allDelivered) continue

            // Mark order as delivered
            const deliveredAt = statuses[0]?.delivered_at || new Date().toISOString()
            await supabase
                .from('orders')
                .update({
                    status: 'delivered',
                    delivered_at: deliveredAt,
                })
                .eq('id', order.id)

            delivered++
            console.log(`DPD delivered: ${order.order_number} (${parcelNumbers.join(', ')})`)

            // Send delivery notification email
            try {
                const locale = order.language || 'en'
                const customerName = (order.shipping_address as any)?.first_name || order.customer_email
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'
                const html = await renderTemplate('delivered', {
                    name: customerName,
                    order_number: String(order.order_number),
                    order_url: `${siteUrl}/orders/${order.id}`,
                    invoice_url: order.invoice_number ? `${siteUrl}/api/orders/${order.id}/invoice?download=1` : `${siteUrl}/orders/${order.id}`,
                }, locale)
                const subjectMap: Record<string, string> = {
                    sl: `Vaše naročilo #${order.order_number} je dostavljeno`,
                    de: `Ihre Bestellung #${order.order_number} wurde geliefert`,
                    it: `Il tuo ordine #${order.order_number} è stato consegnato`,
                    fr: `Votre commande #${order.order_number} a été livrée`,
                }
                const subject = subjectMap[locale] || `Your Order #${order.order_number} Has Been Delivered`
                await sendEmail({ to: order.customer_email, subject, html, skipUnsubscribe: true, orderId: order.id, emailType: 'delivery_notification' })
            } catch (emailErr) {
                console.error(`Failed to send delivered email for ${order.order_number}:`, emailErr)
            }

            // Auto-issue invoice if not already issued
            if (!order.invoice_number) {
                try {
                    const year = new Date().getFullYear()
                    const { count } = await supabase
                        .from('orders')
                        .select('*', { count: 'exact', head: true })
                        .not('invoice_number', 'is', null)
                        .gte('invoice_created_at', `${year}-01-01`)

                    const nextNumber = (count || 0) + 1
                    const invoiceNumber = `ETRG-INV-${year}-${nextNumber.toString().padStart(4, '0')}`

                    await supabase
                        .from('orders')
                        .update({
                            invoice_number: invoiceNumber,
                            invoice_created_at: new Date().toISOString(),
                            invoice_url: `/api/orders/${order.id}/invoice?download=1`,
                        })
                        .eq('id', order.id)

                    invoiced++
                    console.log(`Auto-invoiced: ${order.order_number} → ${invoiceNumber}`)
                } catch (invErr) {
                    console.error(`Failed to auto-invoice ${order.order_number}:`, invErr)
                }
            }

            revalidatePath(`/admin/orders/${order.id}`)
        } catch (err) {
            console.error(`DPD tracking check failed for ${order.order_number}:`, err)
            failed++
        }
    }

    return NextResponse.json({ success: true, checked, delivered, invoiced, failed })
}
