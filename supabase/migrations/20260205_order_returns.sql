-- Create order_returns table
CREATE TABLE IF NOT EXISTS public.order_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'shipped', 'received', 'inspected', 'refunded', 'rejected')),
    reason TEXT NOT NULL CHECK (reason IN ('found_cheaper', 'damaged', 'not_as_described', 'changed_mind', 'other')),
    
    items JSONB NOT NULL, -- Array of { product_id, sku, product_name, quantity, unit_price }
    images TEXT[] DEFAULT '{}', -- Storage URLs for evidence
    
    return_label_url TEXT,
    tracking_number TEXT,
    
    customer_notes TEXT,
    internal_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Customers can create their own returns" 
    ON public.order_returns FOR INSERT 
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view their own returns" 
    ON public.order_returns FOR SELECT 
    USING (auth.uid() = customer_id);

CREATE POLICY "Admins can manage all returns" 
    ON public.order_returns FOR ALL 
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_order_returns_updated_at
    BEFORE UPDATE ON public.order_returns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
