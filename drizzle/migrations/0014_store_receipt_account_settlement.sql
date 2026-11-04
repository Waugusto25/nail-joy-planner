CREATE OR REPLACE FUNCTION public.whatsapp_receipt_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_order public.store_orders%ROWTYPE;
  account_remaining bigint;
BEGIN
  IF TG_OP <> 'UPDATE' OR current_setting('app.store_advance', true) = 'yes' THEN RETURN NEW; END IF;
  IF NEW.paid_amount_cents > coalesce(OLD.paid_amount_cents, 0) THEN
    SELECT * INTO current_order FROM public.store_orders WHERE id = NEW.order_id;
    -- Include other sales for this customer, including archived history. Ignore transferred installments.
    -- Legacy settled rows with zero paid_amount_cents represent a full payment.
    SELECT coalesce(sum(greatest(0, i.amount_cents - CASE
      WHEN i.paid_at IS NOT NULL AND coalesce(i.paid_amount_cents, 0) = 0 THEN i.amount_cents
      ELSE coalesce(i.paid_amount_cents, 0) END)), 0)
    INTO account_remaining
    FROM public.store_order_installments i
    JOIN public.store_orders o ON o.id = i.order_id
    WHERE i.merged_into_order_id IS NULL
      AND (o.id = NEW.order_id OR (current_order.store_client_id IS NOT NULL AND o.store_client_id = current_order.store_client_id));
    PERFORM public.whatsapp_enqueue(
      NEW.id || ':receipt:' || NEW.paid_amount_cents || ':' || NEW.updated_at,
      'receipt',
      jsonb_build_object(
        'phone', current_order.client_phone,
        'amountCents', NEW.paid_amount_cents - coalesce(OLD.paid_amount_cents, 0),
        'number', NEW.number,
        'partial', NEW.paid_amount_cents < NEW.amount_cents,
        'remainingCents', greatest(0, NEW.amount_cents - NEW.paid_amount_cents),
        'accountRemainingCents', account_remaining,
        'installmentId', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END $function$;