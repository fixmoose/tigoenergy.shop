import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1) Delete 5 duplicate placeholder rows
// 65ba5371 → Invoice 15599 already in DB as 48adb4d2
// e1a241b1, f88350f5 → Invoice 16348 already in DB as 8f96b0b2
// 0373fe5e → duplicate of 9c539220 (both Invoice 14174)
// 9ef3ee78 → duplicate of fac2f74c (both Invoice 14175)
const duplicateIds = [
  '65ba5371-4a2f-4ee4-a5eb-30e1db9ed5b0',
  'e1a241b1-c633-4ae8-b480-2dc26890820f',
  'f88350f5-242b-4f1a-8e78-1acdbbc2eda7',
  '0373fe5e-fb41-4ee6-ad18-97d93f05117d',
  '9ef3ee78-f497-417f-8334-b85f8bf83365',
];

const { data: delData, error: delErr } = await supabase
  .from('expenses')
  .delete()
  .in('id', duplicateIds)
  .select('id, notes');

if (delErr) {
  console.error('Delete failed:', delErr);
  process.exit(1);
}
console.log(`Deleted ${delData?.length ?? 0} duplicate rows:`);
console.log(JSON.stringify(delData, null, 2));

// 2) Update 4 Tigo 2025 invoice rows with real data
// EUR conversion via ECB reference rate on invoice date (debits were in USD)
const updates = [
  {
    id: '9c539220-4e7c-47f1-ba11-2d3dfe4642df',
    date: '2025-01-20',
    description: '1200x TS4-A-O optimizatorji (Tigo Energy Order #49624)',
    category: 'Blago',
    amount_eur: 34932.14,
    vat_amount: 0,
    supplier: 'Tigo Energy, Inc.',
    invoice_number: '14174',
    notes:
      'Original file: Invoice 14174_SO49624_Initra Energija.pdf | USD $36,036.00 @ ECB 2025-01-20 rate 1.0316 | PO 12468 | Intra-Community Supply Art. 138, VAT directive 2006/112 (reverse charge, 0% VAT on invoice)',
  },
  {
    id: 'fac2f74c-77ee-456d-a0a3-0e3b454a589a',
    date: '2025-01-20',
    description: '900x TS4-A-2F optimizatorji (Tigo Energy Order #49625)',
    category: 'Blago',
    amount_eur: 31058.55,
    vat_amount: 0,
    supplier: 'Tigo Energy, Inc.',
    invoice_number: '14175',
    notes:
      'Original file: Invoice 14175_SO49625_Initra Energija.pdf | USD $32,040.00 @ ECB 2025-01-20 rate 1.0316 | PO 12466 | Intra-Community Supply Art. 138, VAT directive 2006/112 (reverse charge, 0% VAT on invoice)',
  },
  {
    id: '19682cd6-9559-4f99-940e-c590a491e712',
    date: '2025-05-21',
    description: '1200x TS4-A-O + 30x CCA Kit (Tigo Energy Order #51575)',
    category: 'Blago',
    amount_eur: 35351.56,
    vat_amount: 0,
    supplier: 'Tigo Energy, Inc.',
    invoice_number: '14693',
    notes:
      'Original file: Invoice 14693_SO51575_Initra Energija.pdf | USD $40,021.50 @ ECB 2025-05-21 rate 1.1321 | PO 13328 | Intra-Community Supply Art. 138, VAT directive 2006/112 (reverse charge, 0% VAT on invoice)',
  },
  {
    id: '92c609af-e726-4dab-a364-019b068988dd',
    date: '2025-07-29',
    description: '720x TS4-A-2F EVO2 optimizatorji (Tigo Energy Order #52632)',
    category: 'Blago',
    amount_eur: 24491.64,
    vat_amount: 0,
    supplier: 'Tigo Energy, Inc.',
    invoice_number: '15050',
    notes:
      'Original file: Invoice 15050_SO52632_Initra Energija.pdf | USD $28,353.60 @ invoice-stated EUR rate | PO 13796 | Intra-Community Supply Art. 138, VAT directive 2006/112 (reverse charge, 0% VAT on invoice)',
  },
];

for (const u of updates) {
  const { id, ...fields } = u;
  const { data, error } = await supabase
    .from('expenses')
    .update(fields)
    .eq('id', id)
    .select();
  if (error) {
    console.error(`Update ${id} failed:`, error);
    process.exit(1);
  }
  console.log(`Updated ${id} (${fields.invoice_number}):`, JSON.stringify(data, null, 2));
}
