-- Add new columns to orders table for better payment handling
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS snap_token TEXT,
ADD COLUMN IF NOT EXISTS snap_redirect_url TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add payment methods enum type
DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('cod', 'midtrans', 'bank_transfer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update payment_method column type if needed
ALTER TABLE orders ALTER COLUMN payment_method TYPE payment_method_type USING payment_method::payment_method_type;

-- Create payment_notifications table for tracking payment updates
CREATE TABLE IF NOT EXISTS payment_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL,
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_order_id ON payment_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_transaction_id ON payment_notifications(transaction_id);

-- Update order status enum if not exists
ALTER TABLE orders MODIFY COLUMN status VARCHAR(50);
