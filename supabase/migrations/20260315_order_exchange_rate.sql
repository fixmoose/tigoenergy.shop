-- Add display currency and locked exchange rate to orders
-- This records what currency the customer was browsing in
-- and the EUR→X rate at the time of checkout.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS display_currency TEXT DEFAULT 'EUR';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(12,6) DEFAULT 1.000000;
