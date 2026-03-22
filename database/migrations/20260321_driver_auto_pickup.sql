-- Add is_auto_pickup flag to drivers table
-- Drivers with this flag receive automatic email when a customer pickup order is auto-confirmed
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_auto_pickup BOOLEAN DEFAULT false;
