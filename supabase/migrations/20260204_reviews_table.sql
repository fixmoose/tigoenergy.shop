-- Create Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional if guest reviews allowed later, but good for tracking
    reviewer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Everyone can read reviews
CREATE POLICY "Reviews are public" ON reviews
    FOR SELECT USING (true);

-- 2. Authenticated users can create reviews (Assuming auth is required)
-- If guests allowed, we'd change this. For Tigo Shop, B2B/B2C implies accounts.
CREATE POLICY "Authenticated users can create reviews" ON reviews
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Users can delete their own reviews (optional, user didn't ask, but good practice)
CREATE POLICY "Users can delete own reviews" ON reviews
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Admins have full access (Assumes admin check or broad authenticated for now, restricting via UI/App logic)
-- Actually, let's reuse the generic "Authenticated" policy for delete/update for admins if we don't have specific admin role in db.
-- For now, I'll rely on the app logic for admin deletion (using service role or admin endpoint).

-- Indexes
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);
