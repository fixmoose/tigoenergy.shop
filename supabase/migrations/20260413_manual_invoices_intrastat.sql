-- Wire manual_invoices into the Intrastat dispatch path.
-- Until now only the orders table fed Intrastat dispatches, so historical
-- paper invoices imported as manual_invoices (e.g. 26-RACN-00006 INEL-MONTAŽA)
-- never reached SURS. This migration adds the columns needed to classify and
-- itemize those rows without touching the orders flow.

ALTER TABLE manual_invoices
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'goods',  -- 'goods' | 'service'
    ADD COLUMN IF NOT EXISTS region TEXT,                              -- 'EU' | 'SI' | 'outside_EU'
    ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb; -- line items for Intrastat

CREATE INDEX IF NOT EXISTS idx_manual_invoices_region ON manual_invoices(region);
