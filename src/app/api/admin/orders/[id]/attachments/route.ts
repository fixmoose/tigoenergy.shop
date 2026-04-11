import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function checkAdmin() {
    const cookieStore = await cookies()
    return cookieStore.get('tigo-admin')?.value === '1'
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!await checkAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: orderId } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const note = formData.get('note') as string | null

    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const supabase = await createAdminClient()

    // Upload file to storage
    const ext = file.name.split('.').pop() || 'pdf'
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `attachment_${Date.now()}_${safeName}`
    const filePath = `orders/${orderId}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, Buffer.from(arrayBuffer), {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
        })

    if (uploadError) {
        console.error('Upload error:', uploadError)
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    const fileUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(filePath)}`

    // Append to warehouse_actions
    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? order.warehouse_actions : []
    actions.push({
        action: 'admin_attachment',
        by_email: 'admin',
        by_name: 'Admin',
        at: new Date().toISOString(),
        file_url: fileUrl,
        ...(note ? { note } : {}),
    })

    const { error } = await supabase
        .from('orders')
        .update({ warehouse_actions: actions })
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ success: true, file_url: fileUrl })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!await checkAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: orderId } = await params
    const { actionIndex } = await req.json()

    const supabase = await createAdminClient()

    const { data: order } = await supabase
        .from('orders')
        .select('warehouse_actions')
        .eq('id', orderId)
        .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const actions = Array.isArray(order.warehouse_actions) ? [...order.warehouse_actions] : []
    const removed = actions[actionIndex]
    if (!removed || (removed.action !== 'admin_attachment' && removed.action !== 'uploaded_dobavnica')) {
        return NextResponse.json({ error: 'Cannot remove this action' }, { status: 400 })
    }

    // Delete file from storage
    if (removed.file_url) {
        const urlObj = new URL(removed.file_url, 'http://dummy')
        const path = urlObj.searchParams.get('path')
        if (path) {
            await supabase.storage.from('invoices').remove([path])
        }
    }

    actions.splice(actionIndex, 1)
    const { error } = await supabase
        .from('orders')
        .update({ warehouse_actions: actions })
        .eq('id', orderId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ success: true })
}
