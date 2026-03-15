-- Order Payments table: tracks individual payments for each order (supports partial/multiple payments)
CREATE TABLE IF NOT EXISTS order_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT DEFAULT 'bank_transfer',
    reference TEXT,
    notes TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);

-- Add amount_paid to orders for quick lookups
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;
