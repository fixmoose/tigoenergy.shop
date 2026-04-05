import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const ACCOUNTANT_TOKEN = '123456'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('key')

    if (token !== ACCOUNTANT_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const month = searchParams.get('month')

    const start = month
        ? `${year}-${month.padStart(2, '0')}-01`
        : `${year}-01-01`

    const nextMonthYear = month && parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
    const nextMonth = month && parseInt(month) < 12 ? parseInt(month) + 1 : 1
    const end = month
        ? `${nextMonthYear}-${nextMonth.toString().padStart(2, '0')}-01`
        : `${parseInt(year) + 1}-01-01`

    const supabase = await createAdminClient()

    // Fetch expenses
    const { data: expenses } = await supabase
        .from('expenses')
        .select('id,date,description,category,amount_eur,vat_amount,supplier,invoice_number,receipt_url,notes')
        .gte('date', start)
        .lt('date', end)
        .neq('description', 'Unprocessed')
        .order('date', { ascending: true })

    // Fetch issued invoices (orders with invoice_number)
    const { data: rawInvoices, error: invError } = await supabase
        .from('orders')
        .select('id,order_number,invoice_number,invoice_url,invoice_created_at,total,vat_amount,customer_email,company_name,status,currency,shipping_address')
        .not('invoice_number', 'is', null)
        .gte('invoice_created_at', start)
        .lt('invoice_created_at', end)
        .order('invoice_created_at', { ascending: true })

    if (invError) console.error('Invoice query error:', invError)

    // Extract customer_name from shipping_address
    const invoices = (rawInvoices || []).map(inv => {
        const addr = inv.shipping_address as Record<string, string> | null
        const customerName = addr ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim() : inv.customer_email
        return { ...inv, customer_name: customerName, shipping_address: undefined, source: 'shop' as const }
    })

    // Fetch manual (imported) invoices for the same period
    const { data: manualInvoices } = await supabase
        .from('manual_invoices')
        .select('id,invoice_number,invoice_date,customer_name,company_name,vat_id,net_amount,vat_amount,total,currency,pdf_url')
        .gte('invoice_date', start)
        .lt('invoice_date', end)
        .order('invoice_date', { ascending: true })

    // Merge manual invoices into the invoices list
    const manualMapped = (manualInvoices || []).map(m => ({
        id: m.id,
        order_number: '',
        invoice_number: m.invoice_number,
        invoice_url: m.pdf_url,
        invoice_created_at: m.invoice_date,
        total: Number(m.total),
        vat_amount: Number(m.vat_amount),
        customer_email: '',
        company_name: m.company_name,
        customer_name: m.customer_name || m.company_name || '',
        status: 'imported',
        currency: m.currency,
        source: 'import' as const,
    }))

    const allInvoices = [...invoices, ...manualMapped].sort((a, b) =>
        new Date(a.invoice_created_at).getTime() - new Date(b.invoice_created_at).getTime()
    )

    // Expense totals
    let expenseNet = 0, expenseVat = 0
    for (const e of expenses || []) {
        expenseNet += Number(e.amount_eur) || 0
        expenseVat += Number(e.vat_amount) || 0
    }

    // Invoice totals (includes both shop + imported)
    let invoiceTotal = 0, invoiceVat = 0
    for (const inv of allInvoices) {
        invoiceTotal += Number(inv.total) || 0
        invoiceVat += Number(inv.vat_amount) || 0
    }

    return NextResponse.json({
        success: true,
        data: {
            expenses: expenses || [],
            invoices: allInvoices,
            summary: {
                expenseCount: (expenses || []).length,
                expenseNet,
                expenseVat,
                expenseTotal: expenseNet + expenseVat,
                invoiceCount: allInvoices.length,
                invoiceTotal,
                invoiceVat,
                invoiceNet: invoiceTotal - invoiceVat,
            }
        }
    })
}
