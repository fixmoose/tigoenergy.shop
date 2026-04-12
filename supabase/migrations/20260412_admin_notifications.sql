-- Cross-system notification inbox for admins.
-- Sources: accountant document uploads, warehouse comments/notes, system
-- alerts. Displayed via a bell badge in the admin header and a full
-- history page at /admin/settings/messages.
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Classification
    type TEXT NOT NULL,              -- 'accountant_upload' | 'warehouse_comment' | 'system'
    title TEXT NOT NULL,
    message TEXT,

    -- Who triggered it
    source TEXT NOT NULL DEFAULT 'system',   -- 'accountant' | 'warehouse' | 'system'
    source_name TEXT,                         -- e.g. driver name, "Računovodstvo"

    -- Optional structured data (order_id, file_url, invoice_number, etc.)
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Read state
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);

-- RLS: authenticated access (admin gating is at the app layer via cookie)
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to admin_notifications"
    ON admin_notifications FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
