-- Goods receipts (Prevzem blaga / PRBL) table
-- Tracks incoming material from suppliers for accounting and Intrastat
CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number TEXT NOT NULL UNIQUE,
    receipt_date DATE NOT NULL,
    supplier_name TEXT NOT NULL,
    supplier_country TEXT,
    supplier_invoice_number TEXT,
    supplier_invoice_date DATE,
    warehouse TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_payable DECIMAL(12,2) NOT NULL DEFAULT 0,
    pdf_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admin full access to goods_receipts"
    ON goods_receipts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role bypass
CREATE POLICY "Service role access to goods_receipts"
    ON goods_receipts FOR ALL
    USING (auth.role() = 'service_role');
