-- Supplier Invoices (prejeti računi / Accounts Payable)
-- Parallel to manual_invoices (issued) — this is the received side.
-- Separate from expenses (OPEX ledger) to keep AP as a first-class entity
-- and to carry the structured fields PRBLs / Intrastat need.
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Supplier identity
    supplier_name TEXT NOT NULL,
    supplier_vat_id TEXT,
    supplier_country TEXT,  -- ISO 2-letter; drives the EU/SI/outside_EU routing rule

    -- Invoice identity
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,

    -- Native currency totals
    currency TEXT NOT NULL DEFAULT 'EUR',
    exchange_rate DECIMAL(14,6),  -- to EUR; NULL if currency=EUR
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- EUR-normalized totals (for cross-currency reports / ledger)
    net_amount_eur DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_amount_eur DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_eur DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Classification (per the issued/received × EU/SI/outside_EU rule matrix)
    category TEXT NOT NULL DEFAULT 'goods',  -- 'goods' | 'service'
    region TEXT,                              -- 'EU' | 'SI' | 'outside_EU'

    -- Document + ledger linkage
    pdf_url TEXT,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,  -- optional OPEX ledger tie

    -- Payment state
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMPTZ,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_date ON supplier_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_name);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_country ON supplier_invoices(supplier_country);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_region ON supplier_invoices(region);

-- Prevent duplicate imports of the same supplier invoice
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_invoices_unique
    ON supplier_invoices(supplier_name, invoice_number);

-- Link PRBL (goods_receipts) to the supplier invoice that originated it.
-- One supplier invoice can produce 0..N PRBLs (delayed / partial arrivals).
ALTER TABLE goods_receipts
    ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goods_receipts_supplier_invoice
    ON goods_receipts(supplier_invoice_id);

-- RLS: authenticated users only; app-level admin check (tigo-admin cookie) gates
-- all mutating routes, and service_role bypasses RLS entirely for server code.
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to supplier_invoices"
    ON supplier_invoices FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
