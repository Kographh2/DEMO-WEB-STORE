-- ============================================
-- Payment System v2.0 — additive migration
-- Safe to run multiple times (IF NOT EXISTS everywhere).
-- Does NOT alter existing column types or constraints on `orders`,
-- so it cannot break the existing status/payment_status CHECK
-- constraints or any other code already relying on them.
-- ============================================

-- Add new nullable columns to orders for real-time Midtrans tracking.
-- `status` and `payment_status` are intentionally left untouched —
-- they already exist with the correct enum-style CHECK constraints
-- ('pending'|'paid'|'processing'|'shipped'|'delivered'|'cancelled' and
-- 'pending'|'paid'|'failed'|'expired' respectively).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS snap_token text,
  ADD COLUMN IF NOT EXISTS snap_redirect_url text,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Audit trail for every Midtrans webhook notification received.
CREATE TABLE IF NOT EXISTS public.payment_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_id text NOT NULL,
  status text NOT NULL,
  response_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

-- Only the order owner or the seller of the order can view its payment
-- notifications. Writes happen exclusively through the service-role key
-- from the webhook handler, so no insert/update policy is needed for
-- regular (anon/authenticated) roles.
DROP POLICY IF EXISTS "Order participants can view payment notifications" ON public.payment_notifications;
CREATE POLICY "Order participants can view payment notifications"
  ON public.payment_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_notifications.order_id
        AND (o.user_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON public.orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_order_id ON public.payment_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_transaction_id ON public.payment_notifications(transaction_id);
