import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function requireAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('tigo-admin')?.value === '1'
}

// GET /api/admin/customers/[id]/dashboard
// Returns the full payload that the customer dashboard MyOrders component
// renders: orders, quotes, unpaid invoices, full invoice archive.  This
// backs the "view as customer" mirror on the admin customer detail page so
// admins see the exact same layout the customer sees, with that customer's
// data instead of their own.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: customerId } = await context.params
  const admin = await createAdminClient()

  const { data: customer, error: cErr } = await admin
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()
  if (cErr || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const [ordersRes, quotesRes, unpaidRes, archiveRes] = await Promise.all([
    admin
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    admin
      .from('quotes')
      .select('*')
      .eq('customer_id', customerId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false }),
    customer.vat_id
      ? admin
          .from('manual_invoices')
          .select('id,invoice_number,invoice_date,customer_name,company_name,total,vat_amount,currency,pdf_url,paid')
          .eq('vat_id', customer.vat_id)
          .eq('paid', false)
          .order('invoice_date', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    customer.vat_id
      ? admin
          .from('manual_invoices')
          .select('id,invoice_number,invoice_date,customer_name,company_name,total,net_amount,vat_amount,currency,pdf_url,paid,paid_at,notes')
          .eq('vat_id', customer.vat_id)
          .order('invoice_date', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      customer,
      orders: ordersRes.data || [],
      quotes: quotesRes.data || [],
      unpaidInvoices: unpaidRes.data || [],
      archiveInvoices: archiveRes.data || [],
    },
  })
}
