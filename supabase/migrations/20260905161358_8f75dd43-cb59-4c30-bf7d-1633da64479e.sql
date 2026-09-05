CREATE TABLE public.store_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  nickname text,
  source_profile_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_clients TO authenticated;
GRANT ALL ON public.store_clients TO service_role;
ALTER TABLE public.store_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia clientes da loja" ON public.store_clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_store_clients_updated_at BEFORE UPDATE ON public.store_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.store_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_price_cents integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_order_items_order_id_idx ON public.store_order_items(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_order_items TO authenticated;
GRANT ALL ON public.store_order_items TO service_role;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia itens do pedido" ON public.store_order_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_store_order_items_updated_at BEFORE UPDATE ON public.store_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.store_order_installments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  number integer NOT NULL DEFAULT 1,
  amount_cents integer NOT NULL DEFAULT 0,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, number)
);
CREATE INDEX store_order_installments_order_id_idx ON public.store_order_installments(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_order_installments TO authenticated;
GRANT ALL ON public.store_order_installments TO service_role;
ALTER TABLE public.store_order_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia parcelas do pedido" ON public.store_order_installments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_store_order_installments_updated_at BEFORE UPDATE ON public.store_order_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS store_client_id uuid REFERENCES public.store_clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS store_orders_store_client_id_idx ON public.store_orders(store_client_id);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS pix_key text NOT NULL DEFAULT '';

INSERT INTO public.store_order_items (order_id, name, unit_price_cents, sort_order)
SELECT o.id, o.item_name, o.amount_cents, 0
  FROM public.store_orders o
 WHERE NOT EXISTS (SELECT 1 FROM public.store_order_items i WHERE i.order_id = o.id);

INSERT INTO public.store_order_installments (order_id, number, amount_cents, due_date)
SELECT o.id,
       n,
       CASE WHEN n = greatest(coalesce(o.installments, 1), 1)
            THEN o.amount_cents - (o.amount_cents / greatest(coalesce(o.installments, 1), 1)) * (greatest(coalesce(o.installments, 1), 1) - 1)
            ELSE o.amount_cents / greatest(coalesce(o.installments, 1), 1) END,
       o.delivery_date
  FROM public.store_orders o
  CROSS JOIN LATERAL generate_series(1, greatest(coalesce(o.installments, 1), 1)) AS n
 WHERE NOT EXISTS (SELECT 1 FROM public.store_order_installments p WHERE p.order_id = o.id);