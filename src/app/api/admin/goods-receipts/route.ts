import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function requireAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('tigo-admin')?.value === '1'
}

// GET: list goods receipts with supplier invoice link info
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const url = req.nextUrl
  const year = url.searchParams.get('year')
  const month = url.searchParams.get('month')

  let query = supabase
    .from('goods_receipts')
    .select('*, supplier_invoices(id, supplier_name, invoice_number, total_eur)')
    .order('receipt_date', { ascending: false })

  if (year) {
    const y = parseInt(year)
    if (month) {
      const m = parseInt(month)
      const start = `${y}-${m.toString().padStart(2, '0')}-01`
      const nextM = m < 12 ? m + 1 : 1
      const nextY = m < 12 ? y : y + 1
      const end = `${nextY}-${nextM.toString().padStart(2, '0')}-01`
      query = query.gte('receipt_date', start).lt('receipt_date', end)
    } else {
      query = query.gte('receipt_date', `${y}-01-01`).lte('receipt_date', `${y}-12-31`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

// POST: create a multi-item goods receipt (PRBL) from a list of product lines.
// Body:
//   { supplier_invoice_id?, receipt_date, warehouse?, notes?,
//     lines: [{ product_id, quantity, unit_price_eur }] }
//
// Each line inherits CN code / per-unit weight / country of origin from the
// product catalog so Intrastat fields are set correctly. One document_number
// is generated for the whole receipt; product.stock_quantity is incremented
// for every line.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const {
    supplier_invoice_id,
    receipt_date,
    warehouse,
    notes,
    lines,
  } = body as {
    supplier_invoice_id?: string | null
    receipt_date?: string
    warehouse?: string
    notes?: string
    lines?: Array<{ product_id: string; quantity: number; unit_price_eur: number }>
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: 'At least one line is required' }, { status: 400 })
  }

  for (const [i, line] of lines.entries()) {
    if (!line.product_id) return NextResponse.json({ error: `Line ${i + 1}: product_id required` }, { status: 400 })
    if (!line.quantity || line.quantity <= 0) return NextResponse.json({ error: `Line ${i + 1}: quantity must be > 0` }, { status: 400 })
    if (!line.unit_price_eur || line.unit_price_eur <= 0) return NextResponse.json({ error: `Line ${i + 1}: unit_price_eur must be > 0` }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // 1) Load all referenced products in a single query
  const productIds = [...new Set(lines.map(l => l.product_id))]
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, sku, name_en, cn_code, weight_kg, country_of_origin, stock_quantity')
    .in('id', productIds)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ error: 'One or more products not found' }, { status: 404 })
  }
  const productMap = new Map(products.map(p => [p.id, p]))

  // 2) Load supplier invoice (optional) to inherit supplier identity
  let supplierInvoice: any = null
  if (supplier_invoice_id) {
    const { data, error } = await supabase
      .from('supplier_invoices')
      .select('*')
      .eq('id', supplier_invoice_id)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: `Supplier invoice not found: ${supplier_invoice_id}` }, { status: 404 })
    }
    supplierInvoice = data
  }

  // 3) Generate next YY-PRBL-NNNNN based on receipt_date
  const receiptDateStr = receipt_date || new Date().toISOString().slice(0, 10)
  const yearPrefix = receiptDateStr.slice(2, 4)
  const prefix = `${yearPrefix}-PRBL-`
  const { data: lastRow } = await supabase
    .from('goods_receipts')
    .select('document_number')
    .like('document_number', `${prefix}%`)
    .order('document_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  let nextSeq = 1
  if (lastRow?.document_number) {
    const m = lastRow.document_number.match(/(\d+)$/)
    if (m) nextSeq = parseInt(m[1], 10) + 1
  }
  const documentNumber = `${prefix}${nextSeq.toString().padStart(5, '0')}`

  // 4) Build items[] with inline Intrastat fields for every line
  const items = lines.map(line => {
    const product = productMap.get(line.product_id)!
    return {
      code: product.sku,
      name: product.name_en,
      qty: Number(line.quantity),
      unit: 'KOS',
      price: Number(line.unit_price_eur),
      cn_code: product.cn_code || null,
      weight_kg: product.weight_kg || null,
      country_of_origin: product.country_of_origin || null,
    }
  })

  const netAmount = Number(
    items.reduce((s, it) => s + it.qty * it.price, 0).toFixed(2)
  )

  const row = {
    document_number: documentNumber,
    receipt_date: receiptDateStr,
    supplier_name: supplierInvoice?.supplier_name || body.supplier_name || 'Unknown',
    supplier_country: supplierInvoice?.supplier_country || body.supplier_country || null,
    supplier_invoice_number: supplierInvoice?.invoice_number || body.supplier_invoice_number || null,
    supplier_invoice_date: supplierInvoice?.invoice_date || body.supplier_invoice_date || null,
    supplier_invoice_id: supplierInvoice?.id || null,
    warehouse: warehouse || 'Šenčur skladišče Jurčič Transport',
    items: JSON.stringify(items),
    net_amount: netAmount,
    vat_amount: 0,
    total_payable: netAmount,
    pdf_url: supplierInvoice?.pdf_url || null,
    notes: notes || null,
  }

  // 5) Insert receipt
  const { data: inserted, error: insErr } = await supabase
    .from('goods_receipts')
    .insert(row)
    .select()
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // 6) Bump stock for each product in parallel
  await Promise.all(
    lines.map(line => {
      const product = productMap.get(line.product_id)!
      const newStock = (product.stock_quantity || 0) + Number(line.quantity)
      return supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', line.product_id)
    })
  )

  return NextResponse.json({
    success: true,
    data: { goods_receipt: inserted, line_count: lines.length },
  })
}
