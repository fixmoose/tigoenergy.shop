// Split the large Initra batch PDFs into one file per invoice, upload each
// split under manual-invoices/<invoice_number>.pdf, and repoint every
// manual_invoices.pdf_url that currently references a batch at the new
// individual URL. After this script runs, clicking "PDF" on any invoice
// downloads only that invoice, never the 20 MB bulk file.
//
// Page → invoice mapping is taken from the Initra footer pattern
// "Račun <invoice-number> Stran N/M" which appears on every page. Multi-page
// invoices are grouped by invoice number so spans are preserved.
import { createClient } from '@supabase/supabase-js'
import { PDFDocument } from 'pdf-lib'
// @ts-expect-error no types for pdf-parse
import pdfParse from 'pdf-parse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BATCH_PATHS = [
  'expenses/receipt_1775930934496.pdf', // 20MB — 2025 year-to-date
  'expenses/receipt_1775928390424.pdf', // 2.4MB — newer (2026 + strays)
]

type PageInfo = { pageIndex: number; invoiceNumber: string | null }

async function extractPerPageInvoices(buf: Buffer): Promise<PageInfo[]> {
  const pages: PageInfo[] = []
  // pdf-parse lets us hook per-page rendering. Use that to capture each
  // page's text in isolation and scan for the Initra footer pattern so we
  // know which invoice owns this page.
  const renderPage = async (pageData: any) => {
    const tc = await pageData.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    })
    const pageText = tc.items.map((i: any) => i.str).join(' ')
    // Footer: "Račun 25-RACN-00001Stran 1/2"
    const m = pageText.match(/Račun\s*(2[56]-RACN-\d{5})\s*Stran/)
    pages.push({
      pageIndex: pages.length,
      invoiceNumber: m ? m[1] : null,
    })
    return pageText
  }
  await pdfParse(buf, { pagerender: renderPage })
  return pages
}

async function downloadBatch(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from('invoices').download(path)
  if (error || !data) throw new Error(`Download failed ${path}: ${error?.message}`)
  return Buffer.from(await data.arrayBuffer())
}

async function splitBatch(batchPath: string) {
  console.log(`\n=== ${batchPath} ===`)
  const buf = await downloadBatch(batchPath)
  const pages = await extractPerPageInvoices(buf)
  console.log(`  parsed ${pages.length} pages`)

  // Group by invoice number preserving page order
  const groups = new Map<string, number[]>()
  const unknownPages: number[] = []
  for (const p of pages) {
    if (!p.invoiceNumber) { unknownPages.push(p.pageIndex); continue }
    if (!groups.has(p.invoiceNumber)) groups.set(p.invoiceNumber, [])
    groups.get(p.invoiceNumber)!.push(p.pageIndex)
  }
  console.log(`  grouped ${pages.length - unknownPages.length} pages into ${groups.size} invoices`)
  if (unknownPages.length) {
    console.warn(`  ${unknownPages.length} pages had no footer match: ${unknownPages.slice(0, 10).join(', ')}${unknownPages.length > 10 ? '…' : ''}`)
  }

  // Load source once for pdf-lib copyPages
  const srcDoc = await PDFDocument.load(buf)

  let uploaded = 0
  let skipped = 0
  let updated = 0

  for (const [invNumber, pageIndices] of groups) {
    // Skip if this row isn't actually in the manual_invoices table
    const { data: existing } = await supabase
      .from('manual_invoices')
      .select('id, invoice_number, pdf_url')
      .eq('invoice_number', invNumber)
      .maybeSingle()
    if (!existing) { skipped++; continue }

    // Skip if the row already has a non-batch individual PDF
    const isBatchLink =
      !existing.pdf_url ||
      existing.pdf_url.includes('receipt_1775930934496') ||
      existing.pdf_url.includes('receipt_1775928390424') ||
      existing.pdf_url.includes('PaketniIzpisRacunov')
    if (!isBatchLink) { skipped++; continue }

    // Build a new PDF holding only this invoice's pages
    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(srcDoc, pageIndices)
    for (const p of copied) newDoc.addPage(p)
    const pdfBytes = await newDoc.save()

    // Upload (upsert to tolerate reruns)
    const storagePath = `manual-invoices/${invNumber}.pdf`
    const { error: upErr } = await supabase.storage
      .from('invoices')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (upErr) {
      console.warn(`  !! ${invNumber}: upload failed: ${upErr.message}`)
      continue
    }
    uploaded++

    // Repoint the manual_invoices row at the new file
    const pdfUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}`
    const { error: updErr } = await supabase
      .from('manual_invoices')
      .update({ pdf_url: pdfUrl })
      .eq('id', existing.id)
    if (updErr) {
      console.warn(`  !! ${invNumber}: pdf_url update failed: ${updErr.message}`)
      continue
    }
    updated++
    console.log(`  ${invNumber.padEnd(16)} pages ${pageIndices.map(p => p + 1).join(',')} → ${storagePath}`)
  }

  console.log(`  uploaded ${uploaded}, updated DB ${updated}, skipped ${skipped}`)
}

async function main() {
  for (const batch of BATCH_PATHS) {
    await splitBatch(batch)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
