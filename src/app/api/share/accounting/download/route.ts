import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mergeInvoices } from '@/lib/pdf-merger'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const email = searchParams.get('email')

    if (!token || !email) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })

    const supabase = await createClient()

    // 1. Verify Access
    const { data: share, error: shareError } = await supabase
        .from('accounting_share_links')
        .select('*')
        .eq('token', token)
        .eq('allowed_email', email.toLowerCase().trim())
        .gt('expires_at', new Date().toISOString())
        .single()

    if (shareError || !share) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 2. Fetch Orders with Invoices for that period
    const start = `${share.year}-${share.month.toString().padStart(2, '0')}-01T00:00:00Z`
    const nextMonth = share.month < 12 ? share.month + 1 : 1
    const nextYear = share.month < 12 ? share.year : share.year + 1
    const end = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01T00:00:00Z`

    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('invoice_url')
        .gte('created_at', start)
        .lt('created_at', end)
        .not('invoice_url', 'is', null)

    if (ordersError) throw ordersError

    if (!orders || orders.length === 0) {
        return NextResponse.json({ error: 'No invoices found for this period' }, { status: 404 })
    }

    const pdfUrls = (orders || []).map((o: any) => o.invoice_url)

    // 3. Merge PDFs
    const mergedPdfBytes = await mergeInvoices(pdfUrls)

    if (!mergedPdfBytes) {
        return NextResponse.json({ error: 'Failed to generate bulk PDF' }, { status: 500 })
    }

    // 4. Track download
    await supabase.from('accounting_share_links')
        .update({ download_count: (share.download_count || 0) + 1 })
        .eq('id', share.id)

    // 5. Return PDF
    return new Response(mergedPdfBytes as any, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Tigo_Accounting_${share.year}_${share.month}.pdf"`
        }
    })
}
