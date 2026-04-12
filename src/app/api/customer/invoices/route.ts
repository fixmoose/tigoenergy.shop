import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

// GET /api/customer/invoices
// Returns every manual_invoices row that matches the current customer's VAT ID —
// paid + unpaid together, sorted newest first. Feeds the "Invoice archive"
// section in the customer dashboard. The existing /api/customer/unpaid-invoices
// route keeps its narrower contract for the red-bordered "amount due" widget.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()

  const { data: customer } = await admin
    .from('customers')
    .select('vat_id, company_name')
    .eq('id', user.id)
    .single()

  if (!customer?.vat_id) {
    return NextResponse.json({ success: true, data: [] })
  }

  const { data: invoices, error } = await admin
    .from('manual_invoices')
    .select('id,invoice_number,invoice_date,customer_name,company_name,total,net_amount,vat_amount,currency,pdf_url,paid,paid_at,notes')
    .eq('vat_id', customer.vat_id)
    .order('invoice_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: invoices || [] })
}
