import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function requireAdmin() {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return false
    }
    return true
}

/**
 * Extract invoice data from PDF text.
 * Tries common patterns for Slovenian/EU invoices.
 */
function extractInvoiceData(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const fullText = lines.join(' ')

    // Invoice number patterns
    let invoiceNumber = ''
    const invPatterns = [
        /(?:Račun|Invoice|Faktura|Rechnung)\s*(?:št\.|#|nr\.|No\.?|nummer)?\s*[:\s]*([A-Z0-9][\w\-\/]+)/i,
        /(?:Številka računa|Invoice number|Rechnungsnummer)\s*[:\s]*([A-Z0-9][\w\-\/]+)/i,
        /([A-Z]{2,5}[\-\/]\d{4}[\-\/]\d{3,6})/,  // ETRG-2026-0001 style
        /(\d{4}[\-\/]\d{3,6})/,  // 2026-0001 style
    ]
    for (const pat of invPatterns) {
        const m = fullText.match(pat)
        if (m) { invoiceNumber = m[1]; break }
    }

    // Date patterns
    let invoiceDate = ''
    const datePatterns = [
        /(?:Datum|Date|Datum računa|Invoice date|Rechnungsdatum)\s*[:\s]*(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4})/i,
        /(\d{1,2}\.\d{1,2}\.\d{4})/,  // DD.MM.YYYY
        /(\d{4}-\d{2}-\d{2})/,  // YYYY-MM-DD
    ]
    for (const pat of datePatterns) {
        const m = fullText.match(pat)
        if (m) {
            invoiceDate = parseDate(m[1])
            break
        }
    }

    // Customer / company name
    let customerName = ''
    let companyName = ''
    const custPatterns = [
        /(?:Kupec|Customer|Bill to|Kunde|Naročnik)\s*[:\s]*([^\n]{3,60})/i,
    ]
    for (const pat of custPatterns) {
        const m = fullText.match(pat)
        if (m) { customerName = m[1].trim(); break }
    }

    // Try to find company name near the top (often the first substantial text after header)
    for (const line of lines.slice(0, 20)) {
        if (line.match(/d\.o\.o\.|d\.d\.|GmbH|s\.r\.o\.|Ltd|LLC|Inc|Kft|sp\.\s*z/i)) {
            companyName = line.replace(/[,;]?\s*$/, '')
            break
        }
    }

    // VAT ID
    let vatId = ''
    const vatPatterns = [
        /(?:ID za DDV|VAT ID|VAT|DDV|USt-IdNr|DIČ|OIB)\s*[:\s]*((?:SI|HR|AT|DE|CZ|SK|HU|IT|FR|EE|NL|BE|PL|RO|BG|SE)\s?\d{8,12})/i,
        /(SI\s?\d{8})/,
        /(HR\s?\d{11})/,
    ]
    for (const pat of vatPatterns) {
        const m = fullText.match(pat)
        if (m) { vatId = m[1].replace(/\s/g, ''); break }
    }

    // Amounts
    let total = 0, vatAmount = 0, netAmount = 0

    // Total / Skupaj / Grand Total
    const totalPatterns = [
        /(?:Skupaj|Total|Grand Total|Znesek|Za plačilo|Gesamtbetrag|Celkem)\s*[:\s]*€?\s*([\d.,]+)\s*(?:€|EUR)?/i,
        /€\s*([\d.,]+)\s*$/m,
    ]
    for (const pat of totalPatterns) {
        const m = fullText.match(pat)
        if (m) { total = parseAmount(m[1]); break }
    }

    // VAT / DDV
    const vatPatterns2 = [
        /(?:DDV|VAT|MwSt|DPH)\s*(?:\(\d+\s*%\))?\s*[:\s]*€?\s*([\d.,]+)\s*(?:€|EUR)?/i,
    ]
    for (const pat of vatPatterns2) {
        const m = fullText.match(pat)
        if (m) { vatAmount = parseAmount(m[1]); break }
    }

    // Net / Osnova / Subtotal
    const netPatterns = [
        /(?:Osnova|Subtotal|Neto|Net|Zwischensumme|Základ)\s*[:\s]*€?\s*([\d.,]+)\s*(?:€|EUR)?/i,
    ]
    for (const pat of netPatterns) {
        const m = fullText.match(pat)
        if (m) { netAmount = parseAmount(m[1]); break }
    }

    // Derive missing amounts
    if (total > 0 && vatAmount > 0 && netAmount === 0) netAmount = Number((total - vatAmount).toFixed(2))
    if (total > 0 && netAmount > 0 && vatAmount === 0) vatAmount = Number((total - netAmount).toFixed(2))
    if (total === 0 && netAmount > 0 && vatAmount >= 0) total = Number((netAmount + vatAmount).toFixed(2))

    return {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
        customer_name: customerName || companyName || '',
        company_name: companyName,
        vat_id: vatId,
        net_amount: netAmount,
        vat_amount: vatAmount,
        total,
    }
}

function parseAmount(str: string): number {
    // Handle EU format: 1.234,56 or 1234,56
    let cleaned = str.trim()
    if (cleaned.includes(',') && cleaned.includes('.')) {
        // 1.234,56 → 1234.56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else if (cleaned.includes(',')) {
        // 1234,56 → 1234.56
        cleaned = cleaned.replace(',', '.')
    }
    return Number(cleaned) || 0
}

function parseDate(str: string): string {
    // Try DD.MM.YYYY or DD/MM/YYYY
    const m = str.match(/(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})/)
    if (m) {
        let [, d, mo, y] = m
        if (y.length === 2) y = '20' + y
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // Try YYYY-MM-DD
    const m2 = str.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (m2) return str
    return ''
}

// GET: list manual invoices
export async function GET(req: NextRequest) {
    if (!await requireAdmin()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('manual_invoices')
        .select('*')
        .order('invoice_date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
}

// POST: upload PDF, extract data, save
export async function POST(req: NextRequest) {
    if (!await requireAdmin()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json({ error: 'PDF file required' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Read PDF and extract text
    const buffer = Buffer.from(await file.arrayBuffer())
    let extracted: ReturnType<typeof extractInvoiceData>
    try {
        // Dynamic import to avoid pdf-parse loading its test file at module init
        // @ts-expect-error no types for pdf-parse
        const pdfParse = (await import('pdf-parse')).default
        const parsed = await pdfParse(buffer)
        extracted = extractInvoiceData(parsed.text)
    } catch {
        extracted = {
            invoice_number: file.name.replace('.pdf', ''),
            invoice_date: new Date().toISOString().split('T')[0],
            customer_name: '',
            company_name: '',
            vat_id: '',
            net_amount: 0,
            vat_amount: 0,
            total: 0,
        }
    }

    // Upload PDF to storage
    const storagePath = `manual-invoices/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(storagePath, buffer, { contentType: 'application/pdf' })

    if (uploadError) {
        console.error('Upload error:', uploadError)
        return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 })
    }

    const pdfUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}`

    // Insert into DB
    const { data: invoice, error: insertError } = await supabase
        .from('manual_invoices')
        .insert({
            ...extracted,
            pdf_url: pdfUrl,
        })
        .select()
        .single()

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: invoice })
}

// PATCH: update extracted data
export async function PATCH(req: NextRequest) {
    if (!await requireAdmin()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('manual_invoices')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// DELETE: remove manual invoice
export async function DELETE(req: NextRequest) {
    if (!await requireAdmin()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('manual_invoices')
        .delete()
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
