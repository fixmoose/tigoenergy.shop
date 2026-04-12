// Backfill manual_invoices.items[] for the 35 historical EU-dispatch invoices
// that already exist in the row but have no line-item breakdown yet.
//
// Input data: invoice → [{cn_code, value_eur, weight_kg, products[{name, code,
// qty, country_of_origin}]}].  Per-unit price is derived as
// (cn_line.value_eur / sum(product.qty)) and per-unit weight comes from the
// hardcoded UNIT_WEIGHT table so it doesn't drift from aggregate rounding.
//
// Once populated, generateIntrastatXML picks these up under the flowCode=2
// path and emits RACN declarations for historical months.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Per-unit weight in kg — authoritative source for Intrastat mass.
const UNIT_WEIGHT: Record<string, number> = {
  'TS4-A-O': 0.56,
  'TS4-A-O EVO2': 0.56,
  'TS4-A-2F MC4': 0.59,
  'TS4-A-2F EVO2': 0.59,
  'TS4-A-F': 0.56,
  'CCA Kit': 0.43,
  'TAP': 0.21,
  'RSS Dual Core': 1.0,
  'RSS Commercial Dual Core': 1.0,
  'GO Junction': 0.5,
  'TONGYI TČ': 135,
  'TONGYI TČ R290 12kW': 135,
  'HydroBox': 25,
  'Anti-vibration feet': 5,
};

type Product = {
  name: string;
  code: string;            // internal SKU (119700xxx)
  qty: number;
  country_of_origin: string;
};

type CnLine = {
  cn_code: string;
  value_eur: number;       // aggregated value for this CN
  weight_kg: number;       // aggregated weight for this CN (for reference only)
  products: Product[];
};

type InvoiceEntry = {
  invoice: string;
  cnLines: CnLine[];
};

const INVOICES: InvoiceEntry[] = [
  // ── DE ─────────────────────────────────────────────────────────────
  { invoice: '25-RACN-00006', cnLines: [
    { cn_code: '85363010', value_eur: 99.99, weight_kg: 0.5, products: [
      { name: 'GO Junction', code: '119700900', qty: 1, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00124', cnLines: [
    { cn_code: '84186100', value_eur: 2452.87, weight_kg: 135.0, products: [
      { name: 'TONGYI TČ', code: '119700935', qty: 1, country_of_origin: 'CN' },
    ]},
    { cn_code: '74198090', value_eur: 999.00, weight_kg: 25.0, products: [
      { name: 'HydroBox', code: '119700936', qty: 1, country_of_origin: 'CN' },
    ]},
    { cn_code: '84189910', value_eur: 125.00, weight_kg: 5.0, products: [
      { name: 'Anti-vibration feet', code: '119700937', qty: 1, country_of_origin: 'CN' },
    ]},
  ]},
  // ── EE ─────────────────────────────────────────────────────────────
  { invoice: '25-RACN-00019', cnLines: [
    { cn_code: '90308900', value_eur: 6200.00, weight_kg: 112.0, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 200, country_of_origin: 'CN' },
    ]},
  ]},
  // ── HR ─────────────────────────────────────────────────────────────
  { invoice: '25-RACN-00009', cnLines: [
    { cn_code: '90308900', value_eur: 21595.20, weight_kg: 283.2, products: [
      { name: 'TS4-A-2F MC4', code: '119700909', qty: 480, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00018', cnLines: [
    { cn_code: '90308900', value_eur: 434.00, weight_kg: 7.84, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 14, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 147.00, weight_kg: 0.43, products: [
      { name: 'CCA Kit', code: '119700265', qty: 1, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00022', cnLines: [
    { cn_code: '85437090', value_eur: 476.00, weight_kg: 4.0, products: [
      { name: 'RSS Dual Core', code: '119700267', qty: 4, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00032', cnLines: [
    { cn_code: '84719000', value_eur: 147.00, weight_kg: 0.43, products: [
      { name: 'CCA Kit', code: '119700265', qty: 1, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00036', cnLines: [
    { cn_code: '90308900', value_eur: 132.00, weight_kg: 2.24, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 4, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00037', cnLines: [
    { cn_code: '84719000', value_eur: 179.96, weight_kg: 0.84, products: [
      { name: 'TAP', code: '119700268', qty: 4, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00048', cnLines: [
    { cn_code: '90308900', value_eur: 12747.00, weight_kg: 177.0, products: [
      { name: 'TS4-A-2F MC4', code: '119700909', qty: 300, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00051', cnLines: [
    { cn_code: '90308900', value_eur: 957.00, weight_kg: 16.24, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 29, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 147.00, weight_kg: 0.43, products: [
      { name: 'CCA Kit', code: '119700265', qty: 1, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00052', cnLines: [
    { cn_code: '84719000', value_eur: 804.98, weight_kg: 2.57, products: [
      { name: 'CCA Kit', code: '119700265', qty: 5, country_of_origin: 'CN' },
      { name: 'TAP',     code: '119700268', qty: 2, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00061', cnLines: [
    { cn_code: '90308900', value_eur: 1980.00, weight_kg: 33.6, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 60, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 441.00, weight_kg: 1.29, products: [
      { name: 'CCA Kit', code: '119700265', qty: 3, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00067', cnLines: [
    { cn_code: '90308900', value_eur: 891.00, weight_kg: 15.12, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 27, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 147.00, weight_kg: 0.43, products: [
      { name: 'CCA Kit', code: '119700265', qty: 1, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00068', cnLines: [
    { cn_code: '90308900', value_eur: 12959.45, weight_kg: 179.95, products: [
      { name: 'TS4-A-2F EVO2', code: '119700891', qty: 220, country_of_origin: 'TH' },
      { name: 'TS4-A-2F MC4',  code: '119700909', qty: 85,  country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 1666.00, weight_kg: 14.0, products: [
      { name: 'RSS Commercial Dual Core', code: '119700269', qty: 14, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00071', cnLines: [
    { cn_code: '90308900', value_eur: 4199.00, weight_kg: 59.0, products: [
      { name: 'TS4-A-2F MC4', code: '119700909', qty: 100, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00072', cnLines: [
    { cn_code: '90308900', value_eur: 1740.00, weight_kg: 33.6, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 60, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00079', cnLines: [
    { cn_code: '90308900', value_eur: 6380.00, weight_kg: 162.4, products: [
      { name: 'TS4-A-F', code: '119700264', qty: 290, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 357.00, weight_kg: 3.0, products: [
      { name: 'RSS Commercial Dual Core', code: '119700269', qty: 3, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00089', cnLines: [
    { cn_code: '90308900', value_eur: 2900.00, weight_kg: 56.0, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 100, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00090', cnLines: [
    { cn_code: '90308900', value_eur: 957.00, weight_kg: 16.24, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 29, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 294.00, weight_kg: 0.86, products: [
      { name: 'CCA Kit', code: '119700265', qty: 2, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00091', cnLines: [
    { cn_code: '90308900', value_eur: 1683.00, weight_kg: 28.56, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 51, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 441.00, weight_kg: 1.29, products: [
      { name: 'CCA Kit', code: '119700265', qty: 3, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00099', cnLines: [
    { cn_code: '90308900', value_eur: 1980.00, weight_kg: 33.6, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 60, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 1470.00, weight_kg: 4.3, products: [
      { name: 'CCA Kit', code: '119700265', qty: 10, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00104', cnLines: [
    { cn_code: '90308900', value_eur: 1450.00, weight_kg: 28.0, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 50, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00108', cnLines: [
    { cn_code: '90308900', value_eur: 8198.00, weight_kg: 118.0, products: [
      { name: 'TS4-A-2F EVO2', code: '119700891', qty: 200, country_of_origin: 'TH' },
    ]},
  ]},
  { invoice: '25-RACN-00117', cnLines: [
    { cn_code: '90308900', value_eur: 2838.00, weight_kg: 48.16, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 86, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00118', cnLines: [
    { cn_code: '90308900', value_eur: 29680.00, weight_kg: 593.6, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 1060, country_of_origin: 'CN' },
    ]},
    { cn_code: '84719000', value_eur: 4710.00, weight_kg: 19.2, products: [
      { name: 'CCA Kit', code: '119700265', qty: 30, country_of_origin: 'CN' },
      { name: 'TAP',     code: '119700268', qty: 30, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00122', cnLines: [
    { cn_code: '90308900', value_eur: 13996.50, weight_kg: 206.5, products: [
      { name: 'TS4-A-2F EVO2', code: '119700891', qty: 350, country_of_origin: 'TH' },
    ]},
  ]},
  { invoice: '25-RACN-00128', cnLines: [
    { cn_code: '90308900', value_eur: 5800.00, weight_kg: 112.0, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 200, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00135', cnLines: [
    { cn_code: '90308900', value_eur: 594.00, weight_kg: 10.08, products: [
      { name: 'TS4-A-O EVO2', code: '119700898', qty: 18, country_of_origin: 'TH' },
    ]},
  ]},
  { invoice: '25-RACN-00141', cnLines: [
    { cn_code: '90308900', value_eur: 16800.00, weight_kg: 336.0, products: [
      { name: 'TS4-A-O EVO2', code: '119700898', qty: 600, country_of_origin: 'TH' },
    ]},
    { cn_code: '84719000', value_eur: 1590.00, weight_kg: 6.45, products: [
      { name: 'CCA Kit', code: '119700265', qty: 10, country_of_origin: 'CN' },
      { name: 'TAP',     code: '119700268', qty: 10, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00145', cnLines: [
    { cn_code: '90308900', value_eur: 1254.00, weight_kg: 21.28, products: [
      { name: 'TS4-A-O', code: '119700263', qty: 38, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00149', cnLines: [
    { cn_code: '90308900', value_eur: 6638.34, weight_kg: 97.94, products: [
      { name: 'TS4-A-2F EVO2', code: '119700891', qty: 166, country_of_origin: 'TH' },
    ]},
  ]},
  // ── HU ─────────────────────────────────────────────────────────────
  { invoice: '25-RACN-00039', cnLines: [
    { cn_code: '84719000', value_eur: 145.00, weight_kg: 0.43, products: [
      { name: 'CCA Kit', code: '119700265', qty: 1, country_of_origin: 'CN' },
    ]},
  ]},
  // ── SK ─────────────────────────────────────────────────────────────
  { invoice: '25-RACN-00070', cnLines: [
    { cn_code: '90308900', value_eur: 31200.00, weight_kg: 472.0, products: [
      { name: 'TS4-A-2F EVO2', code: '119700891', qty: 800, country_of_origin: 'TH' },
    ]},
    { cn_code: '84719000', value_eur: 396.00, weight_kg: 4.0, products: [
      { name: 'RSS Dual Core', code: '119700267', qty: 4, country_of_origin: 'CN' },
    ]},
  ]},
  { invoice: '25-RACN-00148', cnLines: [
    { cn_code: '84186100', value_eur: 2581.97, weight_kg: 135.0, products: [
      { name: 'TONGYI TČ R290 12kW', code: '119700935', qty: 1, country_of_origin: 'CN' },
    ]},
  ]},
];

function buildItems(entry: InvoiceEntry) {
  const items: any[] = [];
  for (const line of entry.cnLines) {
    const totalQty = line.products.reduce((s, p) => s + p.qty, 0);
    if (totalQty === 0) continue;
    const pricePerUnit = Number((line.value_eur / totalQty).toFixed(4));

    for (const p of line.products) {
      const unitWeight = UNIT_WEIGHT[p.name];
      if (unitWeight == null) {
        console.warn(`  !! unknown unit weight for ${p.name} (${entry.invoice})`);
      }
      items.push({
        code: p.code,
        name: `Tigo ${p.name}`,
        qty: p.qty,
        unit: 'KOS',
        price: pricePerUnit,
        cn_code: line.cn_code,
        weight_kg: unitWeight ?? 0,
        country_of_origin: p.country_of_origin,
      });
    }
  }
  return items;
}

// Sanity check: compute total value + mass per invoice and compare to expected
let updated = 0;
let skipped = 0;
for (const entry of INVOICES) {
  const items = buildItems(entry);
  const totalValue = items.reduce((s, it) => s + it.qty * it.price, 0);
  const totalMass = items.reduce((s, it) => s + it.qty * it.weight_kg, 0);

  const { data: existing } = await supabase
    .from('manual_invoices')
    .select('id, invoice_number, company_name, net_amount, items')
    .eq('invoice_number', entry.invoice)
    .single();

  if (!existing) {
    console.warn(`  ?? ${entry.invoice} not found in manual_invoices — skipping`);
    skipped++;
    continue;
  }

  const { error } = await supabase
    .from('manual_invoices')
    .update({ items: JSON.stringify(items) })
    .eq('id', existing.id);

  if (error) {
    console.error(`  !! ${entry.invoice} update failed:`, error.message);
    continue;
  }
  updated++;
  console.log(
    `${entry.invoice.padEnd(16)} ${existing.company_name?.slice(0, 25).padEnd(25) || '-'.padEnd(25)} ` +
    `${items.length} items | €${totalValue.toFixed(2).padStart(10)} ${totalMass.toFixed(1).padStart(7)} kg ` +
    `(net €${Number(existing.net_amount).toFixed(2)})`
  );
}

console.log(`\nUpdated ${updated} manual_invoices rows, skipped ${skipped}.`);
