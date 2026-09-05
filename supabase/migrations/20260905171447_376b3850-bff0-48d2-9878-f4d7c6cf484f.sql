ALTER TABLE public.store_order_installments
  ADD COLUMN IF NOT EXISTS merged_into_order_id uuid REFERENCES public.store_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_extra_cents integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS store_order_installments_merged_into_order_id_idx
  ON public.store_order_installments (merged_into_order_id);