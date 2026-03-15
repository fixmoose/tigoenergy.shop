-- Email logs: tracks every email sent from the system
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    email_type TEXT NOT NULL DEFAULT 'unknown',
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    unione_job_id TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    error TEXT,
    sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON email_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
