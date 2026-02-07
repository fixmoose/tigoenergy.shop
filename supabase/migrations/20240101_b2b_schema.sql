
-- Migration to add B2B fields to customers table

DO $$ 
BEGIN
    -- VAT Fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'vat_number') THEN
        ALTER TABLE customers ADD COLUMN vat_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'vat_verified') THEN
        ALTER TABLE customers ADD COLUMN vat_verified BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'vat_verified_at') THEN
        ALTER TABLE customers ADD COLUMN vat_verified_at TIMESTAMPTZ;
    END IF;

    -- Company Fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'company_name') THEN
        ALTER TABLE customers ADD COLUMN company_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'company_address') THEN
        ALTER TABLE customers ADD COLUMN company_address TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'business_type') THEN
        ALTER TABLE customers ADD COLUMN business_type TEXT CHECK (business_type IN ('Installer', 'Reseller', 'Distributor', 'Other'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'website') THEN
        ALTER TABLE customers ADD COLUMN website TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'employees_count') THEN
        ALTER TABLE customers ADD COLUMN employees_count TEXT;
    END IF;

    -- Logistics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'commercial_delivery_access') THEN
        ALTER TABLE customers ADD COLUMN commercial_delivery_access BOOLEAN DEFAULT FALSE;
    END IF;

END $$;
