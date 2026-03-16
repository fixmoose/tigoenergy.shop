-- Migration: add payment terms to customers and payment due dates to orders

-- Customer payment terms: 'prepayment' (default) or 'net30'
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms TEXT NOT NULL DEFAULT 'prepayment';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 0;

-- Order payment due date (set on confirmation based on customer terms)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_due_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS overdue_reminder_sent_at TIMESTAMPTZ;
