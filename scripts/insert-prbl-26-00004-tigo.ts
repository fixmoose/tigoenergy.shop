import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Tigo Energy Invoice 16278 — 2400× TS4-A-O (MC4) @ $30.03, total $72,072.00 / €62,158.352
// Intra-community supply via Baker Tilly NL (fiscal rep NL850811089B01)
// Per-unit EUR = 62158.352 / 2400 = 25.899313...
const row = {
  document_number: '26-PRBL-00004',
  receipt_date: '2026-03-24',
  supplier_name: 'Tigo Energy, Inc.',
  supplier_country: 'NL',
  supplier_invoice_number: '16278',
  supplier_invoice_date: '2026-03-24',
  warehouse: 'Šenčur skladišče Jurčič Transport',
  items: JSON.stringify([
    {
      code: '119700263',
      name: 'Tigo TS4-A-O (MC4)',
      qty: 2400,
      unit: 'KOS',
      price: 25.899313,
      cn_code: '85044095',
      weight_kg: 0.56,
      country_of_origin: 'TH',
    },
  ]),
  net_amount: 62158.35,
  vat_amount: 0,
  total_payable: 62158.35,
  pdf_url: 'expenses/receipt_1775836013170.pdf',
  notes: 'Tigo Energy Inv 16278 | Order #56098 | PO 15135 | USD $72,072.00 @ invoice-stated EUR rate = €62,158.352 | Intra-EU arrival via Baker Tilly NL fiscal rep NL850811089B01. Receipt date = invoice date placeholder — confirm physical arrival.',
};

const { data, error } = await supabase
  .from('goods_receipts')
  .insert(row)
  .select();

if (error) {
  console.error('Insert failed:', error);
  process.exit(1);
}
console.log('Inserted:', JSON.stringify(data, null, 2));
