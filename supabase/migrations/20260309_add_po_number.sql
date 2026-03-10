-- Add PO (Purchase Order) number to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number text;
