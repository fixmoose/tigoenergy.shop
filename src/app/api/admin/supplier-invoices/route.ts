import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { classifyInvoice, regionFor } from '@/lib/invoice-classification'

async function requireAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('tigo-admin')?.value === '1'
}

// GET: list supplier invoices
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const url = req.nextUrl
  const year = url.searchParams.get('year')
  const month = url.searchParams.get('month')
  const region = url.searchParams.get('region')
  const category = url.searchParams.get('category')

  let query = supabase.from('supplier_invoices').select('*').order('invoice_date', { ascending: false })

  if (year) {
    const y = parseInt(year)
    if (month) {
      const m = parseInt(month)
      const start = `${y}-${m.toString().padStart(2, '0')}-01`
      const nextM = m < 12 ? m + 1 : 1
      const nextY = m < 12 ? y : y + 1
      const end = `${nextY}-${nextM.toString().padStart(2, '0')}-01`
      query = query.gte('invoice_date', start).lt('invoice_date', end)
    } else {
      query = query.gte('invoice_date', `${y}-01-01`).lte('invoice_date', `${y}-12-31`)
    }
  }
  if (region) query = query.eq('region', region)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

// POST: create a supplier invoice. Accepts either JSON or multipart/form-data.
// With multipart, the optional 'file' field is uploaded to Supabase storage
// and its URL is stored as pdf_url — one round-trip from the admin form.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = req.headers.get('content-type') || ''
  let body: any = null
  let uploadedPdfUrl: string | null = null

  if (contentType.startsWith('multipart/form-data')) {
    const form = await req.formData()
    body = {}
    for (const [key, value] of form.entries()) {
      if (key === 'file') continue
      if (typeof value === 'string') body[key] = value
    }
    // Coerce numerics
    for (const key of ['net_amount', 'vat_amount', 'total', 'exchange_rate']) {
      if (body[key] != null && body[key] !== '') body[key] = parseFloat(body[key])
    }

    const file = form.get('file') as File | null
    if (file && file.size > 0) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
      }
      const supabase = await createAdminClient()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `supplier-invoices/${Date.now()}_${safeName}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(storagePath, buffer, { contentType: 'application/pdf' })
      if (uploadError) {
        return NextResponse.json({ error: `Failed to upload PDF: ${uploadError.message}` }, { status: 500 })
      }
      uploadedPdfUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}`
    }
  } else {
    body = await req.json().catch(() => null)
  }

  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  if (uploadedPdfUrl) body.pdf_url = uploadedPdfUrl

  const {
    supplier_name,
    supplier_vat_id,
    supplier_country,
    invoice_number,
    invoice_date,
    due_date,
    currency = 'EUR',
    exchange_rate,
    net_amount,
    vat_amount = 0,
    total,
    category = 'goods',
    pdf_url,
    notes,
  } = body

  if (!supplier_name || !invoice_number || !invoice_date || net_amount == null || total == null) {
    return NextResponse.json(
      { error: 'Missing required fields: supplier_name, invoice_number, invoice_date, net_amount, total' },
      { status: 400 }
    )
  }

  // Normalize EUR amounts
  const rate = currency === 'EUR' ? 1 : Number(exchange_rate) || 0
  if (currency !== 'EUR' && rate <= 0) {
    return NextResponse.json({ error: 'exchange_rate is required for non-EUR invoices' }, { status: 400 })
  }
  const net_amount_eur = currency === 'EUR' ? Number(net_amount) : Number((Number(net_amount) / rate).toFixed(2))
  const vat_amount_eur = currency === 'EUR' ? Number(vat_amount) : Number((Number(vat_amount) / rate).toFixed(2))
  const total_eur = currency === 'EUR' ? Number(total) : Number((Number(total) / rate).toFixed(2))

  // Apply the issued/received × region rule matrix — a received invoice from
  // an EU-goods supplier lands in Intrastat arrivals + expense; from SI lands
  // in expense + DDV; from outside_EU lands in expense only.
  const classification = classifyInvoice({
    direction: 'received',
    counterpartyCountry: supplier_country,
    category,
  })

  const row = {
    supplier_name: String(supplier_name).trim(),
    supplier_vat_id: supplier_vat_id || null,
    supplier_country: supplier_country || null,
    invoice_number: String(invoice_number).trim(),
    invoice_date,
    due_date: due_date || null,
    currency,
    exchange_rate: currency === 'EUR' ? null : rate,
    net_amount: Number(net_amount),
    vat_amount: Number(vat_amount),
    total: Number(total),
    net_amount_eur,
    vat_amount_eur,
    total_eur,
    category,
    region: classification.region,
    pdf_url: pdf_url || null,
    notes: notes || null,
  }

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .insert(row)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Duplicate: ${supplier_name} / ${invoice_number} already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data })
}

// PATCH: update a supplier invoice
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { id, ...patch } = body

  // Recompute EUR totals if currency/rate/amount fields changed
  if (patch.currency || patch.exchange_rate != null || patch.net_amount != null || patch.total != null) {
    const supabase = await createAdminClient()
    const { data: existing } = await supabase.from('supplier_invoices').select('*').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const merged = { ...existing, ...patch }
    const rate = merged.currency === 'EUR' ? 1 : Number(merged.exchange_rate) || 0
    if (merged.currency !== 'EUR' && rate <= 0) {
      return NextResponse.json({ error: 'exchange_rate is required for non-EUR invoices' }, { status: 400 })
    }
    patch.net_amount_eur = merged.currency === 'EUR' ? Number(merged.net_amount) : Number((Number(merged.net_amount) / rate).toFixed(2))
    patch.vat_amount_eur = merged.currency === 'EUR' ? Number(merged.vat_amount || 0) : Number((Number(merged.vat_amount || 0) / rate).toFixed(2))
    patch.total_eur = merged.currency === 'EUR' ? Number(merged.total) : Number((Number(merged.total) / rate).toFixed(2))
  }

  if (patch.supplier_country) {
    patch.region = regionFor(patch.supplier_country)
  }

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

// DELETE: remove a supplier invoice
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await createAdminClient()
  const { error } = await supabase.from('supplier_invoices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
