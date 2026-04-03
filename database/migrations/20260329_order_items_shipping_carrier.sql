-- Add per-item shipping carrier for split shipping support
-- NULL = use order-level shipping_carrier (backwards compatible)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shipping_carrier text;
