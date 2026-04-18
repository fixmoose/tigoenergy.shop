import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/warehouse/message
// Warehouse staff sends a general message (with optional file attachment)
// that appears as a notification in the admin bell + messages page.
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const email = form.get('email') as string | null
  const message = form.get('message') as string | null
  const file = form.get('file') as File | null

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (!message && (!file || file.size === 0)) {
    return NextResponse.json({ error: 'message or file required' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Verify driver
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name, email')
    .eq('email', email)
    .eq('is_warehouse', true)
    .single()
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 403 })

  let fileUrl: string | null = null
  let fileName: string | null = null

  if (file && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `warehouse-uploads/${Date.now()}_${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
      })
    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
    fileUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}`
    fileName = file.name
  }

  // Create admin notification
  const { error: notifErr } = await supabase.from('admin_notifications').insert({
    type: 'warehouse_comment',
    title: `Sporočilo od ${driver.name}`,
    message: message || (fileName ? `Priložen dokument: ${fileName}` : null),
    source: 'warehouse',
    source_name: driver.name,
    metadata: {
      ...(fileUrl ? { file_url: fileUrl, file_name: fileName } : {}),
      driver_email: driver.email,
    },
  })

  if (notifErr) {
    return NextResponse.json({ error: notifErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
