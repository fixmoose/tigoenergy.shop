-- Add payment tracking to manual invoices
ALTER TABLE manual_invoices ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE manual_invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
