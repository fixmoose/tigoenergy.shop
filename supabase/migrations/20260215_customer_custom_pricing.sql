-- ============================================================================
-- B2B CUSTOMER PRICES (per-customer per-product pricing overrides)
-- ============================================================================

-- Create the table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS b2b_customer_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- pricing_type: 'simple' (one price) or 'tiered' (quantity breaks)
  pricing_type TEXT NOT NULL DEFAULT 'simple' CHECK (pricing_type IN ('simple', 'tiered')),

  -- For 'simple' pricing
  price_eur DECIMAL(10,2),

  -- For 'tiered' pricing: [{min_qty: 1, price: 100}, {min_qty: 10, price: 90}]
  tier_prices JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One override per customer per product
  UNIQUE(customer_id, product_id)
);

-- Index for fast lookup when calculating prices
CREATE INDEX IF NOT EXISTS idx_b2b_customer_prices_customer_product ON b2b_customer_prices(customer_id, product_id);

-- RLS policies
ALTER TABLE b2b_customer_prices ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by server-side code)
DO $$
BEGIN
    CREATE POLICY "Service role full access on b2b_customer_prices" ON b2b_customer_prices
      FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
    CREATE TRIGGER update_b2b_customer_prices_updated_at
    BEFORE UPDATE ON b2b_customer_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
