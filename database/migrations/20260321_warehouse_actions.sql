-- Add warehouse_actions JSONB column to orders table
-- Tracks actions taken by warehouse team (prepared, uploaded dobavnica, picked up)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_actions jsonb DEFAULT '[]'::jsonb;
