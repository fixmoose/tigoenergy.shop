// Backfill manual_invoices.region from the vat_id country prefix.
// Rows without a vat_id default to SI (domestic, matches historical intent).
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EU_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','ES','SE']);

function regionFromVat(vatId: string | null): 'EU' | 'SI' | 'outside_EU' {
  if (!vatId || vatId.length < 2) return 'SI';  // default domestic
  const prefix = vatId.trim().slice(0, 2).toUpperCase();
  if (prefix === 'SI') return 'SI';
  if (EU_COUNTRIES.has(prefix)) return 'EU';
  return 'outside_EU';
}

const { data: rows, error } = await supabase
  .from('manual_invoices')
  .select('id, invoice_number, company_name, vat_id, region');

if (error) { console.error(error); process.exit(1); }
console.log(`Loaded ${rows?.length} manual_invoices rows`);

let updated = 0;
let skipped = 0;
for (const r of rows || []) {
  const region = regionFromVat(r.vat_id);
  if (r.region === region) { skipped++; continue; }
  const { error: upErr } = await supabase
    .from('manual_invoices')
    .update({ region })
    .eq('id', r.id);
  if (upErr) {
    console.error(`Failed ${r.invoice_number}:`, upErr.message);
    continue;
  }
  updated++;
  console.log(`  ${r.invoice_number.padEnd(30)} ${r.vat_id?.padEnd(15) || '-'.padEnd(15)} → ${region}`);
}

console.log(`\nUpdated ${updated}, skipped ${skipped} (already correct).`);

// Quick sanity summary of the EU rows (the ones that matter for Intrastat)
const { data: eu } = await supabase
  .from('manual_invoices')
  .select('invoice_number, invoice_date, company_name, vat_id, net_amount')
  .eq('region', 'EU')
  .order('invoice_date');
console.log(`\nEU manual_invoices (candidates for Intrastat dispatch): ${eu?.length}`);
for (const r of eu || []) {
  console.log(`  ${r.invoice_date} | ${r.invoice_number} | ${r.company_name} | ${r.vat_id} | €${r.net_amount}`);
}
