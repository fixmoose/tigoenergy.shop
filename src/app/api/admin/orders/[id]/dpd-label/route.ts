import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DPDService, splitStreetAndNumber, calculateTigoParcels } from '@/lib/shipping/dpd'

/**
 * Create DPD label without marking the order as shipped.
 * Useful for pre-generating labels before payment is complete.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createAdminClient()

    try {
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        const address = order.shipping_address as any || {}
        const { street, number } = splitStreetAndNumber(address.street || '')

        // Fetch order items for packaging logic
        const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', id)

        const parcels = calculateTigoParcels((items || []).map(i => ({
            sku: i.sku,
            name: i.product_name,
            quantity: i.quantity,
            weight_kg: i.weight_kg || 0,
        })))
        const weights = parcels.map(p => p.weight)
        const totalWeight = weights.reduce((a, b) => a + b, 0)

        const dpd = new DPDService()
        const shipmentRequest = {
            name1: `${address.first_name || ''} ${address.last_name || ''}`.trim() || order.customer_email,
            name2: order.company_name || '',
            street: street || 'Unknown',
            rPropNum: number || '1',
            city: address.city || '',
            country: address.country || 'SI',
            pcode: address.postal_code || '',
            email: address.email || order.customer_email,
            phone: address.phone || order.customer_phone || '',
            weight: totalWeight,
            num_of_parcel: weights.length,
            order_number: order.order_number,
            parcel_type: order.company_name || order.vat_id ? 'D' : 'D-B2C',
            predict: order.company_name || order.vat_id ? 0 : 1,
        }

        const res = await dpd.createShipment(shipmentRequest, weights)

        if (res.status !== 'ok' || !res.pl_number?.length) {
            throw new Error(res.errlog || 'DPD API denied shipment creation')
        }

        const trackingNumber = res.pl_number.join(', ')
        const trackingUrl = `https://tracking.dpd.de/parcelstatus?query=${res.pl_number[0]}&locale=sl_SI`

        // Get Label PDF and upload
        let labelUrl = ''
        try {
            const pdfBuffer = await dpd.getLabels(res.pl_number)
            const fileName = `shipping_label_${id}_${Date.now()}.pdf`
            const filePath = `orders/${id}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

            if (!uploadError) {
                labelUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(filePath)}`
            }
        } catch (labelErr) {
            console.error('Failed to get DPD label PDF:', labelErr)
        }

        // Save tracking info and label to order (without changing status)
        await supabase
            .from('orders')
            .update({
                tracking_number: trackingNumber,
                tracking_url: trackingUrl,
                shipping_label_url: labelUrl || undefined,
                shipping_carrier: 'DPD',
                shipping_method: 'DPD Classic',
            })
            .eq('id', id)

        return NextResponse.json({
            ok: true,
            trackingNumber,
            trackingUrl,
            labelUrl,
            parcelCount: res.pl_number.length,
        })
    } catch (err: any) {
        console.error('DPD label creation error:', err)
        return NextResponse.json({ error: err.message || 'Failed to create DPD label' }, { status: 500 })
    }
}
