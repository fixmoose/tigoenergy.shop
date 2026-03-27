import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { buildShippingUpdateEmail } from '@/lib/emails/shipping-update'
import { DPDService, splitStreetAndNumber, calculateTigoParcels } from '@/lib/shipping/dpd'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createClient()

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse Body
    const body = await req.json()
    const { carrier } = body
    let { trackingNumber, trackingUrl } = body

    try {
        // 3. Fetch Order (needed for customer info & language)
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // 4. If DPD, generate REAL label via API
        if (carrier === 'DPD') {
            const dpd = new DPDService()
            const address = order.shipping_address || {}
            const { street, number } = splitStreetAndNumber(address.street || '')

            // Fetch order items for packaging logic
            const { data: items } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', id)

            const parcels = calculateTigoParcels(items || [])
            const weights = parcels.map(p => p.weight)
            const totalWeight = weights.reduce((a: number, b: number) => a + b, 0)

            const shipmentRequest = {
                name1: `${address.first_name || ''} ${address.last_name || ''}`.trim(),
                name2: address.company_name || '',
                street: street || 'Unknown',
                rPropNum: number || '1',
                city: address.city || '',
                country: address.country || 'SI',
                pcode: address.postal_code || '',
                email: address.email || order.customer_email,
                phone: address.phone || order.customer_phone || '',
                weight: totalWeight, // Fallback, createShipment will use weights array
                num_of_parcel: weights.length,
                order_number: order.order_number,
                parcel_type: order.is_b2b ? 'D' : 'D-B2C',
                predict: order.is_b2b ? 0 : 1
            }

            const res = await dpd.createShipment(shipmentRequest, weights)

            if (res.status === 'ok' && res.pl_number && res.pl_number.length > 0) {
                trackingNumber = res.pl_number.join(', ') // Save all tracking numbers
                trackingUrl = `https://tracking.dpd.de/parcelstatus?query=${res.pl_number[0]}&locale=sl_SI`

                // Get Label PDF
                try {
                    const pdfBuffer = await dpd.getLabels(res.pl_number)
                    const fileName = `shipping_label_${id}_${Date.now()}.pdf`
                    const filePath = `orders/${id}/${fileName}`

                    const { error: uploadError } = await supabase.storage
                        .from('invoices')
                        .upload(filePath, pdfBuffer, {
                            contentType: 'application/pdf',
                            upsert: true
                        })

                    if (!uploadError) {
                        // Use API route URL instead of public URL (bucket may not be public)
                        const storageUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(filePath)}`

                        await supabase
                            .from('orders')
                            .update({ shipping_label_url: storageUrl })
                            .eq('id', id)
                    }
                } catch (labelErr) {
                    console.error('Failed to get DPD label PDF:', labelErr)
                }
            } else {
                throw new Error(res.errlog || 'DPD API denied shipment creation')
            }
        }

        // 5. Update Order Status
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'shipped',
                shipping_carrier: carrier,
                tracking_number: trackingNumber,
                tracking_url: trackingUrl,
                shipped_at: new Date().toISOString()
            })
            .eq('id', id)

        if (updateError) throw updateError

        // 5. Build and Send Email
        const { subject, html } = buildShippingUpdateEmail({
            orderNumber: order.order_number,
            customerName: `${order.shipping_address?.first_name || ''} ${order.shipping_address?.last_name || ''}`.trim() || 'Customer',
            carrier,
            trackingNumber,
            trackingUrl,
            language: order.language || 'en'
        })

        await sendEmail({
            from: 'Initra Energija <support@tigoenergy.shop>',
            to: order.customer_email,
            subject,
            html,
            orderId: order.id,
            emailType: 'shipping_notification',
        })

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        console.error('Shipping processing error:', err)
        return NextResponse.json({ error: err.message || 'Failed to process shipping' }, { status: 500 })
    }
}
