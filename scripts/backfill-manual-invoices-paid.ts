// Read every manual_invoices PDF, extract the "Ostane za plačilo" remaining
// balance (legacy Initra invoicing software puts this at the bottom of each
// invoice; 0 means paid in full), and flip manual_invoices.paid accordingly.
//
// Sources:
//   - Batch PDF receipt_1775930934496.pdf (168 pages / 151 invoices, all the
//     25-RACN-* rows) is parsed once and matched per invoice number.
//   - Individual pdf_url rows (mostly 26-RACN-*) are downloaded and parsed
//     one by one.
// @ts-expect-error no types for pdf-parse
import pdfParse from 'pdf-parse'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Strip locale thousands separators and swap decimal comma → dot so parseFloat
// handles Slovenian amounts like "1.234,56".
function parseSlovenianAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
}

// Determine whether an invoice has been paid in full by looking at every
// "za plačilo" / "ostane za plačilo" occurrence in its text block. The
// legacy Initra template has two such lines — top ("Za plačilo EUR" = total
// billed) and bottom ("Ostane za plačilo EUR" = remaining balance) — so if
// the remaining balance is zero the bottom line shows 0,00. Simpler
// templates used by other suppliers put a single "Za plačilo" at the bottom
// that already reflects the remaining balance. Either way: if ANY
// occurrence evaluates to 0 the invoice has at least one zero-balance
// marker and is considered paid in full.
// Returns { allBalances, isPaid } where allBalances lists every amount we
// found so callers can log them for sanity checking.
function detectPaid(text: string, invoiceNumber: string): { balances: number[]; isPaid: boolean } | null {
  const idx = text.indexOf(invoiceNumber)
  if (idx < 0) return null
  const after = text.slice(idx + invoiceNumber.length)
  const nextMatch = after.match(/2[56]-RACN-\d{5}/)
  const end = nextMatch && nextMatch.index != null
    ? idx + invoiceNumber.length + after.indexOf(nextMatch[0])
    : text.length
  const block = text.slice(idx, end)

  // Match every "<amount>za plačilo" (case-insensitive, Ostane prefix optional)
  // and collect the amounts.
  const balances: number[] = []
  const pattern = /([\d.]+,\d{2})\s*(?:Ostane\s*)?[Zz]a plačilo/g
  let m: RegExpExecArray | null
  while ((m = pattern.exec(block)) !== null) {
    balances.push(parseSlovenianAmount(m[1]))
  }
  if (balances.length === 0) return null
  // ANY zero-balance line → paid in full.
  const isPaid = balances.some(b => b < 0.01)
  return { balances, isPaid }
}

async function downloadStorageFile(path: string): Promise<Buffer | null> {
  // Normalise: rows store either "expenses/receipt_X.pdf" (raw path) or
  // "/api/storage?bucket=invoices&path=manual-invoices%2F25-RACN-XX.pdf"
  // (URL-wrapped). We always want the bucket path.
  let bucket = 'invoices'
  let key = path
  if (path.startsWith('/api/storage?')) {
    const url = new URL(path, 'http://x')
    bucket = url.searchParams.get('bucket') || 'invoices'
    key = url.searchParams.get('path') || ''
  }
  const { data, error } = await supabase.storage.from(bucket).download(key)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

async function parsePdfBuffer(buf: Buffer): Promise<string> {
  const parsed = await pdfParse(buf)
  return parsed.text
}

async function main() {
  // 1) Load every manual_invoices row we might update.
  const { data: rows, error } = await supabase
    .from('manual_invoices')
    .select('id, invoice_number, invoice_date, total, paid, pdf_url')
    .order('invoice_date')
  if (error) { console.error(error); process.exit(1) }
  const invoices = rows || []
  console.log(`Loaded ${invoices.length} manual_invoices rows.`)

  // 2) Parse the Initra batch PDFs once — the payment footer with
  //    "Ostane za plačilo" lives only in these full exports. Individually
  //    split pages uploaded later sometimes lack the footer entirely.
  //    We concatenate text from every known batch so detectPaid can pick up
  //    whichever batch happens to cover a given invoice.
  const batchPaths = [
    'expenses/receipt_1775930934496.pdf', // 20MB: 2025 year-to-date
    'expenses/receipt_1775928390424.pdf', // 2.4MB: newer batch (likely 2026)
  ]
  console.log('\nParsing batch PDFs once…')
  const batchTextParts: string[] = []
  for (const path of batchPaths) {
    const buf = await downloadStorageFile(path)
    if (!buf) {
      console.warn(`  could not download batch ${path} — skipping`)
      continue
    }
    try {
      const text = await parsePdfBuffer(buf)
      batchTextParts.push(text)
      console.log(`  ${path}: ${text.length} chars`)
    } catch (err: any) {
      console.warn(`  batch parse failed ${path}: ${err?.message}`)
    }
  }
  const batchText = batchTextParts.join('\n\n')
  console.log(`Combined batch text: ${batchText.length} chars`)

  // Pre-index individual PDF caches so we parse each only once even if
  // multiple rows share it.
  const pdfTextCache = new Map<string, string>()

  let paidUpdates = 0
  let unchanged = 0
  let unknown = 0

  for (const inv of invoices) {
    if (!inv.pdf_url) { unknown++; continue }

    // Prefer the big batch whenever it happens to contain this invoice —
    // it carries the full Initra payment footer, while split individual
    // PDFs sometimes only have the top "Za plačilo" line. Fall back to the
    // row's own pdf_url only if the batch doesn't have it.
    let text: string | null = null
    let result: { balances: number[]; isPaid: boolean } | null = null

    if (batchText.indexOf(inv.invoice_number) >= 0) {
      const batchResult = detectPaid(batchText, inv.invoice_number)
      if (batchResult) {
        text = batchText
        result = batchResult
      }
    }

    if (!result) {
      if (!pdfTextCache.has(inv.pdf_url)) {
        const buf = await downloadStorageFile(inv.pdf_url)
        if (!buf) {
          console.warn(`  !! ${inv.invoice_number}: failed to download ${inv.pdf_url}`)
          unknown++
          continue
        }
        try {
          pdfTextCache.set(inv.pdf_url, await parsePdfBuffer(buf))
        } catch (err: any) {
          console.warn(`  !! ${inv.invoice_number}: pdf parse failed: ${err?.message}`)
          unknown++
          continue
        }
      }
      text = pdfTextCache.get(inv.pdf_url)!
      result = detectPaid(text, inv.invoice_number)
    }
    if (!result) {
      console.log(`  ?? ${inv.invoice_number} — no "za plačilo" field found`)
      unknown++
      continue
    }

    const { balances, isPaid } = result
    const statusLabel = isPaid ? 'PAID  ' : 'unpaid'
    const sign = isPaid !== !!inv.paid ? '→' : '='
    const balancesStr = balances.map(b => `€${b.toFixed(2)}`).join(' / ')
    console.log(`  ${sign} ${inv.invoice_number.padEnd(16)} ${inv.invoice_date} | €${Number(inv.total).toFixed(2).padStart(10)} | balances ${balancesStr.padEnd(24)} | ${statusLabel}`)

    if (isPaid === !!inv.paid) { unchanged++; continue }

    const patch: Record<string, any> = { paid: isPaid }
    // Record paid_at as the invoice date (best-effort, since the legacy
    // extract doesn't carry a separate payment timestamp we can trust).
    if (isPaid) patch.paid_at = inv.invoice_date
    else patch.paid_at = null
    const { error: upErr } = await supabase.from('manual_invoices').update(patch).eq('id', inv.id)
    if (upErr) {
      console.error(`    update failed: ${upErr.message}`)
      continue
    }
    paidUpdates++
  }

  console.log(`\nUpdated ${paidUpdates} rows, ${unchanged} already correct, ${unknown} skipped (unknown PDF or field not found).`)
}

main().catch(e => { console.error(e); process.exit(1) })
