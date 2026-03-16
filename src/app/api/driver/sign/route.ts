import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    const { token, signatureData, recipientName } = await req.json()

    if (!token || !signatureData) {
        return NextResponse.json({ error: 'Missing token or signature' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // 1. Validate token
    const { data: delivery, error: fetchError } = await supabase
        .from('delivery_tokens')
        .select('*, orders(id, order_number, status)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .is('signed_at', null)
        .single()

    if (fetchError || !delivery) {
        return NextResponse.json({ error: 'Invalid, expired, or already signed token' }, { status: 404 })
    }

    const orderId = delivery.order_id
    const now = new Date().toISOString()

    // 2. Save signature to storage
    const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const fileName = `signature_${orderId}_${Date.now()}.png`
    const filePath = `orders/${orderId}/${fileName}`

    const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, buffer, { contentType: 'image/png', upsert: true })

    let signatureUrl = ''
    if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(filePath)
        signatureUrl = publicUrl
    }

    // 3. Update delivery token
    await supabase
        .from('delivery_tokens')
        .update({
            signed_at: now,
            signature_data: signatureData,
            recipient_name: recipientName || null,
        })
        .eq('id', delivery.id)

    // 4. Update order with signature and mark as delivered
    await supabase
        .from('orders')
        .update({
            status: 'delivered',
            delivered_at: now,
            signature_url: signatureUrl,
            pod_completed_at: now,
        })
        .eq('id', orderId)

    return NextResponse.json({ success: true, signatureUrl })
}
