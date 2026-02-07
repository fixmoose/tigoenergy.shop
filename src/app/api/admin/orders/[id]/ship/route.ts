import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { buildShippingUpdateEmail } from '@/lib/emails/shipping-update'

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
    const { carrier, trackingNumber, trackingUrl } = await req.json()
    if (!carrier || !trackingNumber || !trackingUrl) {
        return NextResponse.json({ error: 'Missing shipping details' }, { status: 400 })
    }

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

        // 4. Update Order Status
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
            from: 'Tigo Energy Shop <noreply@tigoenergy.shop>',
            to: order.customer_email,
            subject,
            html,
        })

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        console.error('Shipping processing error:', err)
        return NextResponse.json({ error: err.message || 'Failed to process shipping' }, { status: 500 })
    }
}
