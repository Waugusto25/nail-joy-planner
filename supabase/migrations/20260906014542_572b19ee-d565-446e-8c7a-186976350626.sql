ALTER TABLE public.store_order_items
  ADD COLUMN IF NOT EXISTS start_installment integer,
  ADD COLUMN IF NOT EXISTS installments_count integer;