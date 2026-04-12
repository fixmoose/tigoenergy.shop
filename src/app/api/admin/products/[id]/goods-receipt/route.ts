import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function requireAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('tigo-admin')?.value === '1'
}

// POST /api/admin/products/[id]/goods-receipt
// Creates a new PRBL (goods_receipts row) for this product, optionally linked to
// a supplier invoice. Inherits CN code, weight, and country of origin from the
// product catalog so Intrastat fields are set correctly.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: productId } = await context.params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const {
    supplier_invoice_id,
    quantity,
    unit_price_eur,
    receipt_date,
    warehouse,
    notes,
  } = body

  const qty = Number(quantity)
  if (!qty || qty <= 0) {
    return NextResponse.json({ error: 'quantity must be > 0' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // 1) Load product
  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, sku, name_en, cn_code, weight_kg, country_of_origin, stock_quantity')
    .eq('id', productId)
    .single()
  if (pErr || !product) {
    return NextResponse.json({ error: `Product not found: ${pErr?.message || productId}` }, { status: 404 })
  }

  // 2) Load supplier invoice (optional)
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

  // 3) Derive unit price: form value OR per-unit from invoice total
  let pricePerUnit = Number(unit_price_eur)
  if (!pricePerUnit && supplierInvoice) {
    pricePerUnit = Number(supplierInvoice.net_amount_eur || 0) / qty
  }
  if (!pricePerUnit || pricePerUnit <= 0) {
    return NextResponse.json({ error: 'unit_price_eur required (or a linked supplier invoice with net_amount_eur)' }, { status: 400 })
  }
  const netAmount = Number((qty * pricePerUnit).toFixed(2))

  // 4) Compute next PRBL document number for the receipt year
  const receiptDateStr = receipt_date || new Date().toISOString().slice(0, 10)
  const yearPrefix = receiptDateStr.slice(2, 4)  // YY
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

  // 5) Build items JSONB with Intrastat fields inherited from product
  const items = [
    {
      code: product.sku,
      name: product.name_en,
      qty,
      unit: 'KOS',
      price: pricePerUnit,
      cn_code: product.cn_code || null,
      weight_kg: product.weight_kg || null,
      country_of_origin: product.country_of_origin || null,
    },
  ]

  // 6) Inherit supplier identity from the invoice (or fall back to body fields)
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

  const { data: inserted, error: insErr } = await supabase
    .from('goods_receipts')
    .insert(row)
    .select()
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // 7) Increment product stock
  const newStock = (product.stock_quantity || 0) + qty
  await supabase
    .from('products')
    .update({ stock_quantity: newStock })
    .eq('id', productId)

  return NextResponse.json({
    success: true,
    data: { goods_receipt: inserted, product_stock_quantity: newStock },
  })
}
