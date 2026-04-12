import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1) Delete 2 duplicate placeholder rows — Racun 130-2026 and 178-2026 are both
//    StoringCargo monthly invoices already processed (with their own PDFs).
const duplicateIds = [
  '37603f81-b1c6-4a4e-8d54-ffc4582c5100', // Racun 130-2026.pdf (StoringCargo Feb)
  'd4a9714d-9302-4f1b-a194-178368b7883b', // Racun 178-2026.pdf (StoringCargo Mar)
];
const { data: delData, error: delErr } = await supabase
  .from('expenses')
  .delete()
  .in('id', duplicateIds)
  .select('id, notes');
if (delErr) { console.error('Delete failed:', delErr); process.exit(1); }
console.log(`Deleted ${delData?.length} duplicate rows:`);
console.log(JSON.stringify(delData, null, 2));

// 2) Update the KLR-01-481836 (Webtasy) placeholder with real data
const { data: updData, error: updErr } = await supabase
  .from('expenses')
  .update({
    date: '2026-04-11',
    description: 'Podaljšanje domen tigoenergy.at + tigoenergy.it + adriapowerslo.si',
    category: 'Programska oprema & naročnine',
    amount_eur: 94.96,
    vat_amount: 17.12,
    supplier: 'Webtasy d.o.o. / Domenca',
    invoice_number: 'KLR-01-481836',
    notes:
      'Obdelano. .AT domena (tigoenergy.at) 26,22 EUR + .IT domena (tigoenergy.it) 32,78 EUR + .SI domena (adriapowerslo.si) 18,84 EUR. Obdobja 2026–2027. Neto 77,84 EUR + DDV 22 % 17,12 EUR = 94,96 EUR. Račun plačan (TRR).',
  })
  .eq('id', 'e3fe3fec-751a-47b0-80ce-b398949c7722')
  .select();
if (updErr) { console.error('Update failed:', updErr); process.exit(1); }
console.log('\nUpdated KLR-01-481836:');
console.log(JSON.stringify(updData, null, 2));
