-- Add pickup payment proof flag to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_payment_proof_required BOOLEAN DEFAULT false;
