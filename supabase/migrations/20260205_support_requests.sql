-- Create support_requests table
CREATE TABLE IF NOT EXISTS public.support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('shipping', 'return', 'general')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Policies for Customers
CREATE POLICY "Customers can create support requests" 
    ON public.support_requests FOR INSERT 
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view their own requests" 
    ON public.support_requests FOR SELECT 
    USING (auth.uid() = customer_id);

-- Policies for Admins
CREATE POLICY "Admins can view all support requests" 
    ON public.support_requests FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.customers 
        WHERE id = auth.uid() AND (raw_app_metadata->>'role') = 'admin'
    ));

-- Note: In the current app, admin check is often via metadata or a specific table. 
-- Based on Header.tsx, it's user_metadata.role === 'admin'
CREATE POLICY "Admins can manage support requests" 
    ON public.support_requests FOR ALL 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );
