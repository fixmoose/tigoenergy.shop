-- Table for accounting share links
CREATE TABLE IF NOT EXISTS accounting_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    allowed_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    download_count INTEGER DEFAULT 0
);

-- RLS
ALTER TABLE accounting_share_links ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to accounting_shares" ON accounting_share_links
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Public can select if they have the token (needed for the share page)
-- But we will mainly handle verification via API for security
CREATE POLICY "Public with token can read share link" ON accounting_share_links
    FOR SELECT USING (true);
