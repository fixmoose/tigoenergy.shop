-- Late-filing review workflow for expenses.
-- When admin adds/edits an expense whose date is in a past month, we ask
-- Sonja whether to keep it in that month or shift it to the current month.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_review_token UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_review_decided_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_review_action TEXT;          -- 'kept' | 'moved'
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_review_original_date DATE;   -- snapshot before 'moved'

CREATE INDEX IF NOT EXISTS idx_expenses_period_review_token ON expenses(period_review_token);
