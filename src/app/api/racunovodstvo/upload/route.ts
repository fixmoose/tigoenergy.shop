import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/racunovodstvo/upload
// Accountant drops a file (receipt, invoice, document) here. The file is
// stored in Supabase Storage under accountant-uploads/ and an admin
// notification is created so the admin sees "Accountant added documents"
// in their bell dropdown.
export async function POST(req: NextRequest) {
  const url = req.nextUrl
  const accountantKey = url.searchParams.get('key')
  if (!accountantKey || accountantKey !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const note = form.get('note') as string | null

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Upload file to storage
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `accountant-uploads/${Date.now()}_${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('Accountant upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const fileUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}&accountant_key=${accountantKey}`

  // Create admin notification
  await supabase.from('admin_notifications').insert({
    type: 'accountant_upload',
    title: `Računovodstvo: ${file.name}`,
    message: note || `Računovodja je naložil/-a dokument: ${file.name}`,
    source: 'accountant',
    source_name: 'Računovodstvo',
    metadata: {
      file_name: file.name,
      file_url: fileUrl,
      storage_path: storagePath,
      file_size: file.size,
    },
  })

  return NextResponse.json({
    success: true,
    data: { file_name: file.name, file_url: fileUrl },
  })
}
