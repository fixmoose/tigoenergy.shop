-- Notify-accountant batch sends
-- Each row = one click of "Pošlji Sonji v pregled" on /admin/accounting.
-- Per-expense traceability via expenses.accountant_notified_at.

CREATE TABLE IF NOT EXISTS accountant_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recipient_email TEXT NOT NULL,
    expense_count INTEGER NOT NULL DEFAULT 0,
    total_amount_eur DECIMAL(12,2) NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{period: "2026-04", count: 6, total: 10443.15}, ...]
    status TEXT NOT NULL DEFAULT 'sent',         -- 'sent' | 'failed'
    error TEXT
);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accountant_notified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_expenses_accountant_notified_at ON expenses(accountant_notified_at);

ALTER TABLE accountant_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access to accountant_notifications"
    ON accountant_notifications FOR ALL
    USING (auth.role() = 'service_role');
