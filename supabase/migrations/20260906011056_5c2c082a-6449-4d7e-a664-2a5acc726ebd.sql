ALTER TABLE public.store_order_installments
  ADD COLUMN IF NOT EXISTS paid_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_applied_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carried_in_cents integer NOT NULL DEFAULT 0;