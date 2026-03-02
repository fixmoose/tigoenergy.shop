-- Add lead_time_days column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;

-- Update the comment to describe the new field
COMMENT ON COLUMN products.lead_time_days IS 'Number of days to fulfill an order for out-of-stock items that are "Available to Order".';
