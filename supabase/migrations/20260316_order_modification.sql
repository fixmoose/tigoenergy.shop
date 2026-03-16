-- Order modification support
-- Allows customers to convert pending orders back to cart for editing
-- Admin can unlock confirmed orders for modification

ALTER TABLE orders ADD COLUMN IF NOT EXISTS modification_unlocked boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS modification_unlocked_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_order_id uuid REFERENCES orders(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_modification boolean DEFAULT false;

-- Index for finding modifications of an original order
CREATE INDEX IF NOT EXISTS idx_orders_original_order_id ON orders(original_order_id) WHERE original_order_id IS NOT NULL;
