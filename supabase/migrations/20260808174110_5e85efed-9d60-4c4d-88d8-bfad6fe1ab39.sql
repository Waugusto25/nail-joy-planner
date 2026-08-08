CREATE TABLE public.store_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name text NOT NULL,
  client_phone text NOT NULL DEFAULT '',
  item_name text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  payment_method text,
  installments integer NOT NULL DEFAULT 1,
  delivery_date date,
  status text NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_orders TO authenticated;
GRANT ALL ON public.store_orders TO service_role;

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store orders admin all" ON public.store_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_store_orders_updated_at BEFORE UPDATE ON public.store_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();