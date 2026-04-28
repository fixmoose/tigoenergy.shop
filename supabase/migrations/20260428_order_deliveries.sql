-- Order deliveries (partial dobavnicas / shipment splits).
-- Lets admin split a single order across multiple physical pickups or
-- shipments. Each delivery is its own dobavnica + warehouse task. The order
-- itself only completes when every delivery on it is completed, at which
-- point the existing invoice/email flow fires.
--
-- Orders without any rows here keep their original single-dobavnica
-- behavior; this table is purely additive.
CREATE TABLE IF NOT EXISTS order_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    part_number INT NOT NULL,         -- 1, 2, 3 …
    total_parts INT NOT NULL,         -- updated on every insert/delete so
                                      -- "(2/3)" stays correct on slips
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
                                      -- [{ order_item_id, qty,
                                      --    product_name, sku }]
    carrier TEXT,                     -- 'Personal Pick-up' | 'DPD' | …
    status TEXT NOT NULL DEFAULT 'pending',
                                      -- pending | prepared | completed
    warehouse_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    prepared_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (order_id, part_number)
);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_order_id ON order_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_deliveries_status ON order_deliveries(status);

ALTER TABLE order_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to order_deliveries"
    ON order_deliveries FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
