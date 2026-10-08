CREATE OR REPLACE FUNCTION public.reset_paid_amount_when_pending()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Parcela pendente nunca guarda valor pago residual (evita saldo falso de R$ 0,00).
  IF NEW.paid_at IS NULL THEN NEW.paid_amount_cents := 0; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_reset_paid_amount_when_pending ON public.store_order_installments;
CREATE TRIGGER trg_reset_paid_amount_when_pending
BEFORE INSERT OR UPDATE ON public.store_order_installments
FOR EACH ROW EXECUTE FUNCTION public.reset_paid_amount_when_pending();