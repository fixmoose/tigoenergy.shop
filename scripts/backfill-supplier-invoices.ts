import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EU_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','ES','SE']);

function regionFor(country: string | null): string {
  if (!country) return 'outside_EU';
  if (country === 'SI') return 'SI';
  if (EU_COUNTRIES.has(country)) return 'EU';
  return 'outside_EU';
}

// Known USD native amounts for Tigo invoices (from invoice PDFs)
const TIGO_NATIVE: Record<string, { usd: number }> = {
  '14174': { usd: 36036.00 },
  '14175': { usd: 32040.00 },
  '14693': { usd: 40021.50 },
  '15050': { usd: 28353.60 },
  '15599': { usd: 39521.52 },
  '15957': { usd: 26570.00 },
  '16278': { usd: 72072.00 },
  '16348': { usd: 38792.52 },
  // 16008: USD unknown from current context — leave as EUR-only
};

type SupplierProfile = {
  name: string;
  country: string;
  vat_id: string | null;
};

function profileFor(expenseSupplier: string): SupplierProfile | null {
  if (/Tigo Energy/i.test(expenseSupplier)) return { name: 'Tigo Energy, Inc.', country: 'NL', vat_id: 'NL827580186' };
  if (/AB\.COM/i.test(expenseSupplier))     return { name: 'AB.COM SERVICES B.V.', country: 'NL', vat_id: 'NL809927032' };
  if (/SOLSOL/i.test(expenseSupplier))      return { name: 'SOLSOL s.r.o.', country: 'CZ', vat_id: null };
  if (/Microsoft Ireland/i.test(expenseSupplier)) return { name: 'Microsoft Ireland Operations Ltd', country: 'IE', vat_id: 'IE8256796U' };
  return null;
}

function categoryFor(expCategory: string | null): 'goods' | 'service' {
  if (!expCategory) return 'goods';
  const c = expCategory.toLowerCase();
  if (c.includes('blago') || c.includes('zaloga') || c.includes('nabava')) return 'goods';
  if (c.includes('programska') || c.includes('naroč')) return 'service';
  return 'goods';
}

// ---- 1) Load candidate expenses ----
const { data: expenses, error: expErr } = await supabase
  .from('expenses')
  .select('id, date, supplier, invoice_number, amount_eur, vat_amount, category, receipt_url, notes')
  .or('supplier.ilike.%Tigo%,supplier.ilike.%AB.COM%,supplier.ilike.%SOLSOL%,supplier.ilike.%Microsoft Ireland%')
  .order('date');

if (expErr) { console.error(expErr); process.exit(1); }
console.log(`Loaded ${expenses?.length} candidate expenses`);

// ---- 2) Build supplier_invoices rows ----
type Row = {
  expense_id: string;
  supplier_name: string;
  supplier_vat_id: string | null;
  supplier_country: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  exchange_rate: number | null;
  net_amount: number;
  vat_amount: number;
  total: number;
  net_amount_eur: number;
  vat_amount_eur: number;
  total_eur: number;
  category: 'goods' | 'service';
  region: string;
  pdf_url: string | null;
  notes: string | null;
};

const rows: Row[] = [];
for (const e of expenses || []) {
  if (!e.invoice_number || !e.supplier) {
    console.warn(`  skip ${e.id}: missing invoice_number or supplier`);
    continue;
  }
  const profile = profileFor(e.supplier);
  if (!profile) {
    console.warn(`  skip ${e.id}: no profile for '${e.supplier}'`);
    continue;
  }

  const eur = Number(e.amount_eur) || 0;
  const vat = Number(e.vat_amount) || 0;
  const netEur = Number((eur - vat).toFixed(2));

  // Native currency detection
  const tigoNative = /Tigo Energy/i.test(e.supplier) ? TIGO_NATIVE[e.invoice_number] : null;
  let currency = 'EUR';
  let exchangeRate: number | null = null;
  let netNative = netEur;
  let vatNative = vat;
  let totalNative = eur;
  if (tigoNative) {
    currency = 'USD';
    netNative = tigoNative.usd;
    vatNative = 0;  // Tigo invoices are reverse charge (0% VAT)
    totalNative = tigoNative.usd;
    exchangeRate = Number((tigoNative.usd / eur).toFixed(6));
  }

  rows.push({
    expense_id: e.id,
    supplier_name: profile.name,
    supplier_vat_id: profile.vat_id,
    supplier_country: profile.country,
    invoice_number: e.invoice_number,
    invoice_date: e.date,
    currency,
    exchange_rate: exchangeRate,
    net_amount: Number(netNative.toFixed(2)),
    vat_amount: Number(vatNative.toFixed(2)),
    total: Number(totalNative.toFixed(2)),
    net_amount_eur: netEur,
    vat_amount_eur: vat,
    total_eur: eur,
    category: categoryFor(e.category),
    region: regionFor(profile.country),
    pdf_url: e.receipt_url,
    notes: `Backfilled from expense ${e.id}. ${e.notes || ''}`.slice(0, 500),
  });
}

console.log(`\nWill insert ${rows.length} supplier_invoices rows:`);
for (const r of rows) {
  console.log(`  ${r.invoice_date} | ${r.supplier_name} (${r.supplier_country}/${r.region}) | inv=${r.invoice_number} | ${r.currency} ${r.total} (€${r.total_eur}) | ${r.category}`);
}

// ---- 3) Insert (idempotent via unique index on supplier_name + invoice_number) ----
const { data: inserted, error: insErr } = await supabase
  .from('supplier_invoices')
  .upsert(rows, { onConflict: 'supplier_name,invoice_number' })
  .select('id, supplier_name, invoice_number');

if (insErr) { console.error('Insert failed:', insErr); process.exit(1); }
console.log(`\nUpserted ${inserted?.length} rows.`);

// ---- 4) Link existing goods_receipts to the new supplier_invoices rows ----
// We only link 26-PRBL-00004 (Tigo 16278) since the other PRBLs (00001, 00002, 00003)
// have data-quality issues (stored in USD instead of EUR) and should be revisited separately.
const { data: prbl00004 } = await supabase
  .from('goods_receipts')
  .select('id, supplier_invoice_number')
  .eq('document_number', '26-PRBL-00004')
  .single();

if (prbl00004?.supplier_invoice_number) {
  const match = inserted?.find(
    r => r.supplier_name === 'Tigo Energy, Inc.' && r.invoice_number === prbl00004.supplier_invoice_number
  );
  if (match) {
    const { error: linkErr } = await supabase
      .from('goods_receipts')
      .update({ supplier_invoice_id: match.id })
      .eq('id', prbl00004.id);
    if (linkErr) console.error('Link failed:', linkErr);
    else console.log(`\nLinked 26-PRBL-00004 → supplier_invoices ${match.id} (Tigo inv ${match.invoice_number})`);
  }
}
