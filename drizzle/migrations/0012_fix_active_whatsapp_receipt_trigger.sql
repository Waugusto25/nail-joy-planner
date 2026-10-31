CREATE OR REPLACE FUNCTION public.whatsapp_receipt_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
 IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
 IF NEW.paid_amount_cents > coalesce(OLD.paid_amount_cents, 0) THEN
  PERFORM public.whatsapp_enqueue(
   NEW.id || ':receipt:' || NEW.paid_amount_cents,
   'receipt',
   jsonb_build_object(
    'phone', (SELECT client_phone FROM public.store_orders WHERE id = NEW.order_id),
    'amountCents', NEW.paid_amount_cents - coalesce(OLD.paid_amount_cents, 0),
    'number', NEW.number,
    'partial', NEW.paid_amount_cents < NEW.amount_cents,
    'remainingCents', greatest(0, NEW.amount_cents - NEW.paid_amount_cents),
    'installmentId', NEW.id
   )
  );
 END IF;
 RETURN NEW;
END
$function$;