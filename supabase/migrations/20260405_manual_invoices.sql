-- Manual invoices imported from external invoicing software
CREATE TABLE IF NOT EXISTS manual_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    customer_name TEXT,
    company_name TEXT,
    vat_id TEXT,
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    pdf_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_invoices_date ON manual_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_manual_invoices_number ON manual_invoices(invoice_number);
