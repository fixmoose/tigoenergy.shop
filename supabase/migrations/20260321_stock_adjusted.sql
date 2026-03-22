-- Add stock_adjusted flag to orders table to prevent double stock deduction
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_adjusted BOOLEAN DEFAULT FALSE;

-- Add index for quick lookup of orders that haven't had stock adjusted
CREATE INDEX IF NOT EXISTS idx_orders_stock_adjusted ON orders (stock_adjusted) WHERE stock_adjusted = FALSE;
