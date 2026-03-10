-- Track how many times an order has been sent to the client by admin
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_send_count integer DEFAULT 0;
