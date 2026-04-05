import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib'

const ACCOUNTANT_TOKEN = '123456'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('key')
    if (token !== ACCOUNTANT_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const month = searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'Month required' }, { status: 400 })

    const monthNames = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December']
    const periodLabel = `${monthNames[parseInt(month) - 1]} ${year}`

    const start = `${year}-${month.padStart(2, '0')}-01`
    const nextMonthYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
    const nextMonth = parseInt(month) < 12 ? parseInt(month) + 1 : 1
    const end = `${nextMonthYear}-${nextMonth.toString().padStart(2, '0')}-01`

    const supabase = await createAdminClient()

    // Fetch expenses
    const { data: expenses } = await supabase
        .from('expenses')
        .select('id,date,description,category,amount_eur,vat_amount,supplier,invoice_number,receipt_url')
        .gte('date', start)
        .lt('date', end)
        .neq('description', 'Unprocessed')
        .order('date', { ascending: true })

    // Fetch issued invoices (shop)
    const { data: rawInvoices } = await supabase
        .from('orders')
        .select('id,order_number,invoice_number,invoice_url,invoice_created_at,total,vat_amount,customer_email,company_name,shipping_address')
        .not('invoice_number', 'is', null)
        .gte('invoice_created_at', start)
        .lt('invoice_created_at', end)
        .order('invoice_created_at', { ascending: true })

    const shopInvoices = (rawInvoices || []).map(inv => {
        const addr = inv.shipping_address as Record<string, string> | null
        const name = addr ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim() : inv.customer_email
        return { ...inv, customer_name: name, source: 'shop' as const }
    })

    // Fetch manual invoices
    const { data: manualInvoices } = await supabase
        .from('manual_invoices')
        .select('id,invoice_number,invoice_date,customer_name,company_name,net_amount,vat_amount,total,pdf_url')
        .gte('invoice_date', start)
        .lt('invoice_date', end)
        .order('invoice_date', { ascending: true })

    // Build the merged PDF
    const mergedPdf = await PDFDocument.create()
    const font = await mergedPdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold)

    // --- Cover / Index Page ---
    const allInvoices = [
        ...shopInvoices.map(i => ({
            number: i.invoice_number,
            date: i.invoice_created_at,
            customer: i.company_name || i.customer_name,
            total: Number(i.total),
            vat: Number(i.vat_amount || 0),
            source: 'shop' as const,
        })),
        ...(manualInvoices || []).map(m => ({
            number: m.invoice_number,
            date: m.invoice_date,
            customer: m.company_name || m.customer_name || '',
            total: Number(m.total),
            vat: Number(m.vat_amount || 0),
            source: 'import' as const,
        }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Cover page
    addCoverPage(mergedPdf, font, fontBold, periodLabel, allInvoices, expenses || [])

    // Section: Issued Invoices
    addSectionPage(mergedPdf, fontBold, 'IZDANI RAČUNI / ISSUED INVOICES', periodLabel)

    // Append each shop invoice PDF
    for (const inv of shopInvoices) {
        if (inv.invoice_url) {
            await appendPdfFromUrl(mergedPdf, inv.invoice_url, req)
        }
    }

    // Append each manual invoice PDF
    for (const inv of (manualInvoices || [])) {
        if (inv.pdf_url) {
            await appendPdfFromStorage(mergedPdf, supabase, inv.pdf_url)
        }
    }

    // Section: Expenses / Received
    addSectionPage(mergedPdf, fontBold, 'PREJETI RAČUNI / EXPENSES', periodLabel)

    // Append each expense receipt
    for (const exp of (expenses || [])) {
        if (exp.receipt_url) {
            await appendPdfFromStorage(mergedPdf, supabase, exp.receipt_url)
        }
    }

    const pdfBytes = await mergedPdf.save()
    const filename = `Initra_${year}_${month.padStart(2, '0')}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
        }
    })
}

function addCoverPage(
    doc: PDFDocument,
    font: PDFFont,
    fontBold: PDFFont,
    period: string,
    invoices: { number: string; date: string; customer: string; total: number; vat: number }[],
    expenses: { date: string; description: string; supplier: string | null; amount_eur: number; vat_amount: number }[]
) {
    const page = doc.addPage([595.28, 841.89]) // A4
    const { height } = page.getSize()
    let y = height - 50

    // Header
    page.drawText('INITRA ENERGIJA d.o.o.', { x: 50, y, font: fontBold, size: 16, color: rgb(0.1, 0.1, 0.1) })
    y -= 20
    page.drawText('Podsmreka 59A, 1356 Dobrova | ID za DDV: SI62518313', { x: 50, y, font, size: 8, color: rgb(0.5, 0.5, 0.5) })
    y -= 30
    page.drawText(`Mesečni pregled — ${period}`, { x: 50, y, font: fontBold, size: 13, color: rgb(0.2, 0.2, 0.2) })
    y -= 30

    // Summary box
    const invTotal = invoices.reduce((s, i) => s + i.total, 0)
    const invVat = invoices.reduce((s, i) => s + i.vat, 0)
    const expTotal = expenses.reduce((s, e) => s + Number(e.amount_eur), 0)
    const expVat = expenses.reduce((s, e) => s + Number(e.vat_amount || 0), 0)

    page.drawText(`Izdani računi: ${invoices.length}   |   Skupaj: EUR ${invTotal.toFixed(2)}   |   DDV: EUR ${invVat.toFixed(2)}`, { x: 50, y, font: fontBold, size: 9, color: rgb(0.0, 0.5, 0.3) })
    y -= 16
    page.drawText(`Prejeti računi: ${expenses.length}   |   Skupaj: EUR ${expTotal.toFixed(2)}   |   DDV: EUR ${expVat.toFixed(2)}`, { x: 50, y, font: fontBold, size: 9, color: rgb(0.7, 0.1, 0.1) })
    y -= 30

    // Issued Invoices table
    if (invoices.length > 0) {
        page.drawText('IZDANI RAČUNI', { x: 50, y, font: fontBold, size: 10, color: rgb(0.2, 0.2, 0.2) })
        y -= 5
        page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
        y -= 12

        // Header row
        page.drawText('Datum', { x: 50, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('Št. računa', { x: 110, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('Kupec', { x: 220, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('DDV', { x: 430, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('Skupaj', { x: 490, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        y -= 12

        for (const inv of invoices) {
            if (y < 100) {
                // Continue on new page
                const newPage = doc.addPage([595.28, 841.89])
                y = newPage.getSize().height - 50
                // We'll just break — for large lists this is fine
                break
            }
            const d = new Date(inv.date)
            const ds = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`
            page.drawText(ds, { x: 50, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(inv.number || '', { x: 110, y, font: fontBold, size: 7, color: rgb(0.1, 0.1, 0.1) })
            const custTrunc = (inv.customer || '').substring(0, 40)
            page.drawText(custTrunc, { x: 220, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(`€${inv.vat.toFixed(2)}`, { x: 430, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(`€${inv.total.toFixed(2)}`, { x: 490, y, font: fontBold, size: 7, color: rgb(0.1, 0.1, 0.1) })
            y -= 11
        }
        y -= 10
    }

    // Expenses table
    if (expenses.length > 0 && y > 150) {
        page.drawText('PREJETI RAČUNI / STROŠKI', { x: 50, y, font: fontBold, size: 10, color: rgb(0.2, 0.2, 0.2) })
        y -= 5
        page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
        y -= 12

        page.drawText('Datum', { x: 50, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('Opis', { x: 110, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('Dobavitelj', { x: 290, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('DDV', { x: 430, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('Skupaj', { x: 490, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        y -= 12

        for (const exp of expenses) {
            if (y < 60) break
            const d = new Date(exp.date)
            const ds = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`
            page.drawText(ds, { x: 50, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText((exp.description || '').substring(0, 35), { x: 110, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText((exp.supplier || '-').substring(0, 25), { x: 290, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(`€${Number(exp.vat_amount || 0).toFixed(2)}`, { x: 430, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(`€${Number(exp.amount_eur).toFixed(2)}`, { x: 490, y, font: fontBold, size: 7, color: rgb(0.1, 0.1, 0.1) })
            y -= 11
        }
    }
}

function addSectionPage(
    doc: PDFDocument,
    fontBold: PDFFont,
    title: string,
    period: string
) {
    const page = doc.addPage([595.28, 841.89])
    const { width, height } = page.getSize()
    page.drawText(title, { x: 50, y: height / 2 + 20, font: fontBold, size: 22, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(period, { x: 50, y: height / 2 - 10, font: fontBold, size: 14, color: rgb(0.5, 0.5, 0.5) })
}

async function appendPdfFromUrl(doc: PDFDocument, url: string, req: NextRequest) {
    try {
        // Shop invoices are generated on-the-fly via /api/orders/[id]/invoice
        const origin = req.nextUrl.origin
        const fullUrl = url.startsWith('http') ? url : `${origin}${url}`
        // Add accountant key for auth
        const fetchUrl = fullUrl.includes('?') ? `${fullUrl}&accountant_key=${ACCOUNTANT_TOKEN}` : `${fullUrl}?accountant_key=${ACCOUNTANT_TOKEN}`

        const res = await fetch(fetchUrl)
        if (!res.ok) return
        const contentType = res.headers.get('content-type') || ''

        if (contentType.includes('pdf')) {
            const bytes = await res.arrayBuffer()
            const srcPdf = await PDFDocument.load(bytes)
            const pages = await doc.copyPages(srcPdf, srcPdf.getPageIndices())
            pages.forEach(p => doc.addPage(p))
        }
    } catch (e) {
        console.error('Error appending PDF from URL:', url, e)
    }
}

async function appendPdfFromStorage(doc: PDFDocument, supabase: any, storageUrl: string) {
    try {
        // Parse: /api/storage?bucket=invoices&path=expenses%2Freceipt_xxx.pdf
        // Or: /api/storage?bucket=invoices&path=manual-invoices/26-RACN-00006.pdf
        const urlObj = new URL(storageUrl, 'http://dummy')
        const bucket = urlObj.searchParams.get('bucket')
        const path = urlObj.searchParams.get('path')

        if (!bucket || !path) return

        const { data, error } = await supabase.storage.from(bucket).download(path)
        if (error || !data) return

        const bytes = await data.arrayBuffer()
        const contentType = data.type || ''

        if (contentType.includes('pdf') || path.endsWith('.pdf')) {
            const srcPdf = await PDFDocument.load(bytes)
            const pages = await doc.copyPages(srcPdf, srcPdf.getPageIndices())
            pages.forEach(p => doc.addPage(p))
        } else if (contentType.includes('image') || path.match(/\.(jpg|jpeg|png)$/i)) {
            // Embed image as a full page
            const imgBytes = new Uint8Array(bytes)
            let img
            if (contentType.includes('png') || path.endsWith('.png')) {
                img = await doc.embedPng(imgBytes)
            } else {
                img = await doc.embedJpg(imgBytes)
            }
            const page = doc.addPage([595.28, 841.89])
            const { width: pw, height: ph } = page.getSize()
            const scale = Math.min((pw - 40) / img.width, (ph - 40) / img.height, 1)
            const w = img.width * scale
            const h = img.height * scale
            page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
        }
    } catch (e) {
        console.error('Error appending from storage:', storageUrl, e)
    }
}
