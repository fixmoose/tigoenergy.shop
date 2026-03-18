-- Quotes table (mirrors orders structure)
CREATE TABLE IF NOT EXISTS quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number text NOT NULL UNIQUE,

    -- Token for public access (customer link)
    token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

    -- Customer info
    customer_id uuid REFERENCES customers(id),
    customer_email text NOT NULL,
    customer_phone text,
    company_name text,
    vat_id text,
    is_b2b boolean DEFAULT false,

    -- Addresses (JSONB)
    shipping_address jsonb,
    billing_address jsonb,

    -- Pricing
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
    vat_rate numeric(5,2) NOT NULL DEFAULT 0,
    vat_amount numeric(10,2) NOT NULL DEFAULT 0,
    total numeric(10,2) NOT NULL DEFAULT 0,
    currency text DEFAULT 'EUR',

    -- Market / Locale
    market text NOT NULL DEFAULT 'si',
    language text NOT NULL DEFAULT 'en',

    -- Status lifecycle: draft → sent → viewed → accepted → expired / declined
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','sent','viewed','accepted','expired','declined')),

    -- Expiry
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),

    -- Tracking
    sent_at timestamptz,
    viewed_at timestamptz,
    accepted_at timestamptz,

    -- Resulting order
    order_id uuid REFERENCES orders(id),

    -- Internal
    internal_notes text,
    created_by text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Quote items
CREATE TABLE IF NOT EXISTS quote_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_id uuid,
    sku text NOT NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    weight_kg numeric(8,3),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_token ON quotes(token);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- RLS policies (allow service role full access, admin cookie users via supabase client)
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admin uses service role key anyway)
CREATE POLICY "Allow all for authenticated" ON quotes FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON quote_items FOR ALL USING (true);
