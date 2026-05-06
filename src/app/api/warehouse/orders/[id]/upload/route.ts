import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = await params
    const formData = await req.formData()
    const email = formData.get('email') as string
    const file = formData.get('file') as File | null
    const deliveryId = (formData.get('delivery_id') as string | null) || null

    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const supabase = await createAdminClient()

    const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, email')
        .eq('email', email)
        .eq('is_warehouse', true)
        .single()
    if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Upload file to storage
    const ext = file.name.split('.').pop() || 'pdf'
    const fileName = `dobavnica_${orderId}_${Date.now()}.${ext}`
    const filePath = `orders/${orderId}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, Buffer.from(arrayBuffer), {
            contentType: file.type || 'application/pdf',
            upsert: true,
        })

    if (uploadError) {
        console.error('Upload error:', uploadError)
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    const fileUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(filePath)}`

    const newAction = {
        action: 'uploaded_dobavnica',
        by_email: driver.email,
        by_name: driver.name,
        at: new Date().toISOString(),
        file_url: fileUrl,
    }

    // Split-delivery card → write to the delivery's audit log instead of the order's
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
        const { error } = await supabase
            .from('order_deliveries')
            .update({ warehouse_actions: dActions })
            .eq('id', deliveryId)
        if (error) return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 })
        return NextResponse.json({ success: true, file_url: fileUrl })
    }

    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
    actions.push(newAction)

    const { error } = await supabase
        .from('orders')
        .update({ warehouse_actions: actions })
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ success: true, file_url: fileUrl })
}
