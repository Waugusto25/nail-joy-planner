CREATE TABLE public.store_deleted_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_data jsonb NOT NULL,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_deleted_log TO authenticated;
GRANT ALL ON public.store_deleted_log TO service_role;
ALTER TABLE public.store_deleted_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read deleted log" ON public.store_deleted_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.log_store_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.store_deleted_log(table_name,row_data,deleted_by) VALUES (TG_TABLE_NAME, to_jsonb(OLD), auth.uid());
  RETURN OLD;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_store_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_delete_store_orders BEFORE DELETE ON public.store_orders FOR EACH ROW EXECUTE FUNCTION public.log_store_delete();
CREATE TRIGGER log_delete_store_order_items BEFORE DELETE ON public.store_order_items FOR EACH ROW EXECUTE FUNCTION public.log_store_delete();
CREATE TRIGGER log_delete_store_order_installments BEFORE DELETE ON public.store_order_installments FOR EACH ROW EXECUTE FUNCTION public.log_store_delete();

-- Bloqueia exclusão em massa de pedidos (mais de 1 por comando)
CREATE OR REPLACE FUNCTION public.block_bulk_store_order_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM old_rows) > 1 THEN
    RAISE EXCEPTION 'Exclusão em massa de pedidos bloqueada.';
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER block_bulk_store_orders AFTER DELETE ON public.store_orders REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.block_bulk_store_order_delete();