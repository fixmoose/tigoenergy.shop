// Normalise the many shapes an invoice pdf_url can take so it resolves as a
// working href from any admin or customer page.
//
// Historical rows store raw Supabase Storage bucket paths
// (e.g. "expenses/receipt_1775930934496.pdf") because they were imported
// before the /api/storage auth layer existed. Newer rows store a full
// "/api/storage?bucket=invoices&path=…" URL. A few are absolute http(s)
// URLs. Rendering any of these directly as an anchor href breaks for the
// raw-path case because the browser treats the value as a relative URL and
// navigates to https://host/expenses/receipt_X.pdf which 404s.
//
// Always run pdf_url through this helper before using it as a download
// link. Returns null for blank/missing values so callers can hide the
// button.
export function resolveInvoicePdfUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/api/')) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  // Raw bucket path — wrap in /api/storage so the authenticated route
  // streams the file back with the right content-type + auth check.
  return `/api/storage?bucket=invoices&path=${encodeURIComponent(trimmed)}`
}
