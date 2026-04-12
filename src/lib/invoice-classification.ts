// Single source of truth for the issued/received × EU/SI/outside_EU rule matrix.
// Applied at ingestion so every invoice (issued or received, auto or manual)
// routes itself to the correct downstream reports (Intrastat, DDV-O, Income,
// Expense, WEEE).
//
// Matrix:
//   Issued invoice (we are seller):
//     - EU  → Intrastat (dispatch/odprema) + Income
//     - SI  → Income + DDV + WEEE
//     - outside_EU (export) → Income only
//   Received invoice (we are buyer):
//     - EU  → Intrastat (arrival/prejem)  + Expense  [goods only]
//     - SI  → Expense + DDV
//     - outside_EU (import) → Expense only
//   Services never appear in Intrastat regardless of origin.

export type InvoiceDirection = 'issued' | 'received'
export type InvoiceCategory = 'goods' | 'service'
export type Region = 'EU' | 'SI' | 'outside_EU'

export type ReportTarget =
  | 'intrastat_dispatch'
  | 'intrastat_arrival'
  | 'income'
  | 'expense'
  | 'ddv'
  | 'weee'

// ISO 2-letter codes for EU member states (excl. SI, which is domestic here)
const EU_COUNTRIES: ReadonlySet<string> = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','ES','SE',
])

export function regionFor(country: string | null | undefined): Region {
  if (!country) return 'outside_EU'
  const c = country.toUpperCase()
  if (c === 'SI') return 'SI'
  if (EU_COUNTRIES.has(c)) return 'EU'
  return 'outside_EU'
}

export interface ClassifyInput {
  direction: InvoiceDirection
  counterpartyCountry: string | null | undefined  // ISO 2-letter
  category?: InvoiceCategory                       // default 'goods'
}

export interface ClassifyResult {
  region: Region
  targets: ReportTarget[]
}

export function classifyInvoice({ direction, counterpartyCountry, category = 'goods' }: ClassifyInput): ClassifyResult {
  const region = regionFor(counterpartyCountry)
  const targets: ReportTarget[] = []

  if (direction === 'issued') {
    // Income is always recorded
    targets.push('income')
    if (region === 'SI') {
      targets.push('ddv')
      // WEEE (eTROD) applies to electronic equipment placed on the Slovenian
      // market — goods only, B2C and B2B alike. Services are exempt.
      if (category === 'goods') targets.push('weee')
    } else if (region === 'EU' && category === 'goods') {
      targets.push('intrastat_dispatch')
    }
    // outside_EU: income only (export)
  } else {
    // Received: expense is always recorded
    targets.push('expense')
    if (region === 'SI') {
      targets.push('ddv')
    } else if (region === 'EU' && category === 'goods') {
      targets.push('intrastat_arrival')
    }
    // outside_EU: expense only (import)
  }

  return { region, targets }
}
