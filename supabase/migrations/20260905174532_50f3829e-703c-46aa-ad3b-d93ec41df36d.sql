ALTER TABLE public.store_order_installments
  ADD COLUMN IF NOT EXISTS added_extra_cents integer NOT NULL DEFAULT 0;