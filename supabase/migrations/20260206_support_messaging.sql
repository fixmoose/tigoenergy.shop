-- Support Messaging System Migration

-- 1. Update support_requests to handle guest emails and optional customer_id
ALTER TABLE public.support_requests 
    ALTER COLUMN customer_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS guest_email TEXT,
    ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- 2. Create support_messages for threaded conversation
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.customers(id), -- Null for guest or admin if using metadata
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'admin', 'guest')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create guest_verifications for OTP flow
CREATE TABLE IF NOT EXISTS public.guest_verifications (
    email TEXT PRIMARY KEY,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_verifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for support_messages
CREATE POLICY "Users can view messages for their own requests" 
    ON public.support_messages FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.support_requests r 
            WHERE r.id = support_messages.request_id 
            AND (r.customer_id = auth.uid() OR r.guest_email = (SELECT email FROM public.guest_verifications WHERE verified = TRUE LIMIT 1)) -- Simplified guest check for now
        )
    );

CREATE POLICY "Users can insert messages to their own requests" 
    ON public.support_messages FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.support_requests r 
            WHERE r.id = support_messages.request_id 
            AND (r.customer_id = auth.uid() OR r.guest_email = (SELECT email FROM public.guest_verifications WHERE verified = TRUE LIMIT 1))
        )
    );

CREATE POLICY "Admins can manage all support messages" 
    ON public.support_messages FOR ALL 
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 6. RLS Policies for guest_verifications
-- Allow anonymous insert for OTP generation
CREATE POLICY "Allow anonymous OTP creation" 
    ON public.guest_verifications FOR INSERT 
    WITH CHECK (TRUE);

-- Allow anonymous select for verification check
CREATE POLICY "Allow anonymous verification check" 
    ON public.guest_verifications FOR SELECT 
    USING (TRUE);
