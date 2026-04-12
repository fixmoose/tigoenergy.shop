// Fix existing PRBLs created before the supplier_invoices + Intrastat-inline
// convention was in place. Three rows to repair:
//   26-PRBL-00001  Tigo CCA Kit   (USD stored as if EUR — needs EUR conversion)
//   26-PRBL-00002  Tigo TS4-A-O EVO2 (USD stored as if EUR — needs EUR conversion)
//   26-PRBL-00003  SOLSOL DAH 580W (EUR correct; just needs supplier_invoice_id + inline Intrastat fields)
//
// Each row is rewritten with:
//   - supplier_invoice_id FK to the matching backfilled supplier_invoices row
//   - items[] gains inline cn_code / weight_kg / country_of_origin so the
//     Intrastat XML generator doesn't need the fallback product map
//   - net_amount / total_payable normalised to EUR
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function supplierInvoiceIdFor(supplierName: string, invoiceNumber: string): Promise<string | null> {
  const { data } = await supabase
    .from('supplier_invoices')
    .select('id')
    .eq('supplier_name', supplierName)
    .eq('invoice_number', invoiceNumber)
    .maybeSingle();
  return data?.id || null;
}

// ---- 26-PRBL-00001 : Tigo CCA Kit → Tigo Inv 15957 ----
{
  const supplierInvoiceId = await supplierInvoiceIdFor('Tigo Energy, Inc.', '15957');
  if (!supplierInvoiceId) throw new Error('Tigo 15957 supplier invoice not found');

  const qty = 200;
  const netEur = 22774.79;
  const pricePerUnit = Number((netEur / qty).toFixed(6));
  const items = [
    {
      code: '119700265',
      name: 'Tigo CCA Kit',
      qty,
      unit: 'KOS',
      price: pricePerUnit,
      cn_code: '84719000',
      weight_kg: 0.43,
      country_of_origin: 'CN',
    },
  ];

  const { data, error } = await supabase
    .from('goods_receipts')
    .update({
      items: JSON.stringify(items),
      net_amount: netEur,
      vat_amount: 0,
      total_payable: netEur,
      supplier_invoice_id: supplierInvoiceId,
      supplier_invoice_number: '15957',
      supplier_invoice_date: '2026-01-13',
      notes: 'Intra-EU arrival. Repaired: items[].price now EUR (was USD), supplier_invoice_id linked.',
    })
    .eq('document_number', '26-PRBL-00001')
    .select('document_number, net_amount, supplier_invoice_id');
  if (error) throw error;
  console.log('Fixed 26-PRBL-00001:', data);
}

// ---- 26-PRBL-00002 : Tigo TS4-A-O EVO2 → Tigo Inv 16008 ----
{
  const supplierInvoiceId = await supplierInvoiceIdFor('Tigo Energy, Inc.', '16008');
  if (!supplierInvoiceId) throw new Error('Tigo 16008 supplier invoice not found');

  const qty = 1200;
  const netEur = 30709.30;
  const pricePerUnit = Number((netEur / qty).toFixed(6));
  const items = [
    {
      code: '119700898',
      name: 'Tigo TS4-A-O (EVO2)',
      qty,
      unit: 'KOS',
      price: pricePerUnit,
      cn_code: '90308900',
      weight_kg: 0.56,
      country_of_origin: 'TH',
    },
  ];

  const { data, error } = await supabase
    .from('goods_receipts')
    .update({
      items: JSON.stringify(items),
      net_amount: netEur,
      vat_amount: 0,
      total_payable: netEur,
      supplier_invoice_id: supplierInvoiceId,
      supplier_invoice_number: '16008',
      supplier_invoice_date: '2026-01-23',
      notes: 'Intra-EU arrival. Repaired: items[].price now EUR (was USD), supplier_invoice_id linked.',
    })
    .eq('document_number', '26-PRBL-00002')
    .select('document_number, net_amount, supplier_invoice_id');
  if (error) throw error;
  console.log('Fixed 26-PRBL-00002:', data);
}

// ---- 26-PRBL-00003 : SOLSOL → Inv 260100733 ----
// EUR amounts already correct; add inline Intrastat fields + link supplier_invoice_id.
{
  const supplierInvoiceId = await supplierInvoiceIdFor('SOLSOL s.r.o.', '260100733');
  if (!supplierInvoiceId) throw new Error('SOLSOL 260100733 supplier invoice not found');

  const items = [
    // Transport line — service, skipped by Intrastat generator
    { code: '119700279', name: 'Prevoz - AP', qty: 1, unit: 'X', price: 88 },
    // Goods line — add inline Intrastat fields
    {
      code: '119700931',
      name: 'DAH 580W',
      qty: 36,
      unit: 'KOS',
      price: 63.22,
      cn_code: '85414300',
      weight_kg: 28.5,
      country_of_origin: 'VN',
    },
  ];

  const { data, error } = await supabase
    .from('goods_receipts')
    .update({
      items: JSON.stringify(items),
      supplier_invoice_id: supplierInvoiceId,
    })
    .eq('document_number', '26-PRBL-00003')
    .select('document_number, net_amount, supplier_invoice_id');
  if (error) throw error;
  console.log('Fixed 26-PRBL-00003:', data);
}
