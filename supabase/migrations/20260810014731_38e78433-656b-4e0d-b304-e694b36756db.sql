ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link text;