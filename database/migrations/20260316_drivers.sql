-- Drivers table for managing delivery drivers (used in admin settings + delivery step dropdown)
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_email ON drivers(email);

-- RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "admin_all_drivers" ON drivers
    FOR ALL USING (true) WITH CHECK (true);
