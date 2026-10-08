ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS store_orders_archived_at_idx ON public.store_orders (archived_at);