import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await createAdminClient()

    // Get customer's VAT ID and company name
    const { data: customer } = await admin
        .from('customers')
        .select('vat_id, company_name')
        .eq('id', user.id)
        .single()

    if (!customer?.vat_id) {
        return NextResponse.json({ success: true, data: [] })
    }

    // Find unpaid manual invoices matching this customer's VAT ID
    const { data: invoices } = await admin
        .from('manual_invoices')
        .select('id,invoice_number,invoice_date,customer_name,company_name,total,vat_amount,currency,pdf_url,paid')
        .eq('vat_id', customer.vat_id)
        .eq('paid', false)
        .order('invoice_date', { ascending: false })

    return NextResponse.json({ success: true, data: invoices || [] })
}
