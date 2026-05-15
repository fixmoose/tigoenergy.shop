/**
 * Build a merged-PDF "monthly bundle" containing:
 *   - cover page with totals + index of both directions
 *   - all issued shop invoices + manual/imported invoices (outgoing)
 *   - all expense receipts/incoming invoices (incoming)
 *
 * Shared by /api/racunovodstvo/download (accountant view) and
 * /api/admin/accounting/export (admin view) — same output, different
 * auth gates.
 */
import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import { generateInvoicePdf } from '@/lib/invoice-pdf'

const MONTHS_SI = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December']

function sanitize(text: string): string {
    const map: Record<string, string> = {
        'č': 'c', 'Č': 'C', 'š': 's', 'Š': 'S', 'ž': 'z', 'Ž': 'Z',
        'ć': 'c', 'Ć': 'C', 'đ': 'd', 'Đ': 'D',
        'ř': 'r', 'Ř': 'R', 'ě': 'e', 'Ě': 'E', 'ň': 'n', 'Ň': 'N',
        'ť': 't', 'Ť': 'T', 'ď': 'd', 'Ď': 'D', 'ů': 'u', 'Ů': 'U',
        'ľ': 'l', 'Ľ': 'L', 'ĺ': 'l', 'Ĺ': 'L', 'ŕ': 'r', 'Ŕ': 'R',
        '—': '-', '–': '-', ' ': ' ',
    }
    return text.replace(/[^\x00-\x7FÀ-ÿ]/g, ch => map[ch] || '')
}

export async function buildMonthlyBundle(
    supabase: any,
    year: string,
    month: string,
): Promise<{ pdfBytes: Uint8Array; filename: string }> {
    const periodLabel = `${MONTHS_SI[parseInt(month) - 1]} ${year}`
    const start = `${year}-${month.padStart(2, '0')}-01`
    const nextMonthYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
    const nextMonth = parseInt(month) < 12 ? parseInt(month) + 1 : 1
    const end = `${nextMonthYear}-${nextMonth.toString().padStart(2, '0')}-01`

    const { data: expenses } = await supabase
        .from('expenses')
        .select('id,date,description,category,amount_eur,vat_amount,supplier,invoice_number,receipt_url')
        .gte('date', start)
        .lt('date', end)
        .neq('description', 'Unprocessed')
        .order('date', { ascending: true })

    const { data: rawInvoices } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .not('invoice_number', 'is', null)
        .gte('invoice_created_at', start)
        .lt('invoice_created_at', end)
        .order('invoice_created_at', { ascending: true })

    const shopInvoices = (rawInvoices || []).map((inv: any) => {
        const addr = inv.shipping_address as Record<string, string> | null
        const name = addr ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim() : inv.customer_email
        return { ...inv, customer_name: name, source: 'shop' as const }
    })

    const { data: manualInvoices } = await supabase
        .from('manual_invoices')
        .select('id,invoice_number,invoice_date,customer_name,company_name,net_amount,vat_amount,total,pdf_url')
        .gte('invoice_date', start)
        .lt('invoice_date', end)
        .order('invoice_date', { ascending: true })

    const mergedPdf = await PDFDocument.create()
    const font = await mergedPdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold)

    const allInvoices = [
        ...shopInvoices.map((i: any) => ({
            number: i.invoice_number,
            date: i.invoice_created_at,
            customer: i.company_name || i.customer_name,
            total: Number(i.total),
            vat: Number(i.vat_amount || 0),
            source: 'shop' as const,
        })),
        ...(manualInvoices || []).map((m: any) => ({
            number: m.invoice_number,
            date: m.invoice_date,
            customer: m.company_name || m.customer_name || '',
            total: Number(m.total),
            vat: Number(m.vat_amount || 0),
            source: 'import' as const,
        }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    addCoverPage(mergedPdf, font, fontBold, periodLabel, allInvoices, expenses || [])
    addSectionPage(mergedPdf, fontBold, 'IZDANI RACUNI / ISSUED INVOICES', periodLabel)

    for (const inv of shopInvoices) {
        try {
            const pdfBytes = await generateInvoicePdf(inv as any, supabase)
            const srcPdf = await PDFDocument.load(pdfBytes)
            const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices())
            pages.forEach(p => mergedPdf.addPage(p))
        } catch (e) {
            console.error('Error generating invoice PDF for order:', (inv as any).id, e)
        }
    }
    for (const inv of (manualInvoices || [])) {
        if ((inv as any).pdf_url) await appendPdfFromStorage(mergedPdf, supabase, (inv as any).pdf_url)
    }

    addSectionPage(mergedPdf, fontBold, 'PREJETI RACUNI / EXPENSES', periodLabel)
    for (const exp of (expenses || [])) {
        if ((exp as any).receipt_url) await appendPdfFromStorage(mergedPdf, supabase, (exp as any).receipt_url)
    }

    const pdfBytes = await mergedPdf.save()
    const filename = `Initra_${year}_${month.padStart(2, '0')}.pdf`
    return { pdfBytes, filename }
}

function addCoverPage(
    doc: PDFDocument, font: PDFFont, fontBold: PDFFont, period: string,
    invoices: { number: string; date: string; customer: string; total: number; vat: number }[],
    expenses: { date: string; description: string; supplier: string | null; amount_eur: number; vat_amount: number }[],
) {
    const page = doc.addPage([595.28, 841.89])
    const { height } = page.getSize()
    let y = height - 50

    page.drawText('INITRA ENERGIJA d.o.o.', { x: 50, y, font: fontBold, size: 16, color: rgb(0.1, 0.1, 0.1) })
    y -= 20
    page.drawText('Podsmreka 59A, 1356 Dobrova | ID za DDV: SI62518313', { x: 50, y, font, size: 8, color: rgb(0.5, 0.5, 0.5) })
    y -= 30
    page.drawText(sanitize(`Mesecni pregled - ${period}`), { x: 50, y, font: fontBold, size: 13, color: rgb(0.2, 0.2, 0.2) })
    y -= 30

    const invTotal = invoices.reduce((s, i) => s + i.total, 0)
    const invVat = invoices.reduce((s, i) => s + i.vat, 0)
    const expTotal = expenses.reduce((s, e) => s + Number(e.amount_eur), 0)
    const expVat = expenses.reduce((s, e) => s + Number(e.vat_amount || 0), 0)

    page.drawText(sanitize(`Izdani racuni: ${invoices.length}   |   Skupaj: EUR ${invTotal.toFixed(2)}   |   DDV: EUR ${invVat.toFixed(2)}`), { x: 50, y, font: fontBold, size: 9, color: rgb(0.0, 0.5, 0.3) })
    y -= 16
    page.drawText(sanitize(`Prejeti racuni: ${expenses.length}   |   Skupaj: EUR ${expTotal.toFixed(2)}   |   DDV: EUR ${expVat.toFixed(2)}`), { x: 50, y, font: fontBold, size: 9, color: rgb(0.7, 0.1, 0.1) })
    y -= 30

    if (invoices.length > 0) {
        page.drawText('IZDANI RACUNI', { x: 50, y, font: fontBold, size: 10, color: rgb(0.2, 0.2, 0.2) })
        y -= 5
        page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
        y -= 12
        page.drawText('Datum', { x: 50, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('St. racuna', { x: 110, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('Kupec', { x: 220, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('DDV', { x: 430, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        page.drawText('Skupaj', { x: 490, y, font: fontBold, size: 7, color: rgb(0.4, 0.4, 0.4) })
        y -= 12
        for (const inv of invoices) {
            if (y < 100) break
            const d = new Date(inv.date)
            const ds = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`
            page.drawText(ds, { x: 50, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(inv.number || '', { x: 110, y, font: fontBold, size: 7, color: rgb(0.1, 0.1, 0.1) })
            page.drawText(sanitize((inv.customer || '').substring(0, 40)), { x: 220, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(`EUR ${inv.vat.toFixed(2)}`, { x: 430, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(`EUR ${inv.total.toFixed(2)}`, { x: 490, y, font: fontBold, size: 7, color: rgb(0.1, 0.1, 0.1) })
            y -= 11
        }
        y -= 10
    }

    if (expenses.length > 0 && y > 150) {
        page.drawText('PREJETI RACUNI / STROSKI', { x: 50, y, font: fontBold, size: 10, color: rgb(0.2, 0.2, 0.2) })
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
            page.drawText(sanitize((exp.description || '').substring(0, 35)), { x: 110, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(sanitize((exp.supplier || '-').substring(0, 25)), { x: 290, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(`EUR ${Number(exp.vat_amount || 0).toFixed(2)}`, { x: 430, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) })
            page.drawText(`EUR ${Number(exp.amount_eur).toFixed(2)}`, { x: 490, y, font: fontBold, size: 7, color: rgb(0.1, 0.1, 0.1) })
            y -= 11
        }
    }
}

function addSectionPage(doc: PDFDocument, fontBold: PDFFont, title: string, period: string) {
    const page = doc.addPage([595.28, 841.89])
    const { height } = page.getSize()
    page.drawText(title, { x: 50, y: height / 2 + 20, font: fontBold, size: 22, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(period, { x: 50, y: height / 2 - 10, font: fontBold, size: 14, color: rgb(0.5, 0.5, 0.5) })
}

async function appendPdfFromStorage(doc: PDFDocument, supabase: any, storageUrl: string) {
    try {
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
            const imgBytes = new Uint8Array(bytes)
            const img = (contentType.includes('png') || path.endsWith('.png')) ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes)
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
