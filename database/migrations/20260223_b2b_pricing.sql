-- Migration: Add B2B per-customer pricing support
CREATE TABLE IF NOT EXISTS b2b_customer_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    price_eur DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_b2b_prices_customer ON b2b_customer_prices(customer_id);
CREATE INDEX IF NOT EXISTS idx_b2b_prices_product ON b2b_customer_prices(product_id);

-- Add updated_at trigger
CREATE TRIGGER update_b2b_customer_prices_updated_at 
BEFORE UPDATE ON b2b_customer_prices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
