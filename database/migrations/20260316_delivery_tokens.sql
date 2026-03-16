-- Delivery tokens for driver portal (digital dobavnica with signature capture)
CREATE TABLE IF NOT EXISTS delivery_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    driver_email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    signed_at TIMESTAMPTZ,
    signature_data TEXT,  -- base64 PNG of signature
    recipient_name TEXT,  -- typed name of person who signed
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT  -- admin email who sent it
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_delivery_tokens_token ON delivery_tokens(token);
CREATE INDEX IF NOT EXISTS idx_delivery_tokens_driver ON delivery_tokens(driver_email);
CREATE INDEX IF NOT EXISTS idx_delivery_tokens_order ON delivery_tokens(order_id);

-- Add signature_url to orders for storing the final POD image
ALTER TABLE orders ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pod_completed_at TIMESTAMPTZ;

-- RLS
ALTER TABLE delivery_tokens ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "admin_all_delivery_tokens" ON delivery_tokens
    FOR ALL USING (true) WITH CHECK (true);
