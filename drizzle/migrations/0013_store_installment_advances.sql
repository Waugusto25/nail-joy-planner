CREATE TABLE public.store_installment_advances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 installment_id uuid NOT NULL REFERENCES public.store_order_installments(id) ON DELETE RESTRICT,
 amount_cents integer NOT NULL CHECK (amount_cents > 0),
 paid_on date NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_installment_advances TO authenticated;
GRANT ALL ON public.store_installment_advances TO service_role;
ALTER TABLE public.store_installment_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_advances_admin_read ON public.store_installment_advances FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX store_installment_advances_installment_id_idx ON public.store_installment_advances(installment_id);
CREATE OR REPLACE FUNCTION public.reset_paid_amount_when_pending() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE advanced integer;
BEGIN
 SELECT coalesce(sum(amount_cents),0)::integer INTO advanced FROM public.store_installment_advances WHERE installment_id=NEW.id;
 IF NEW.paid_at IS NULL THEN NEW.paid_amount_cents:=advanced;
 ELSE NEW.paid_amount_cents:=greatest(coalesce(NEW.paid_amount_cents,0),advanced); END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.whatsapp_receipt_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP<>'UPDATE' OR current_setting('app.store_advance',true)='yes' THEN RETURN NEW; END IF;
 IF NEW.paid_amount_cents>coalesce(OLD.paid_amount_cents,0) THEN
  PERFORM public.whatsapp_enqueue(NEW.id||':receipt:'||NEW.paid_amount_cents||':'||NEW.updated_at,'receipt',jsonb_build_object('phone',(SELECT client_phone FROM public.store_orders WHERE id=NEW.order_id),'amountCents',NEW.paid_amount_cents-coalesce(OLD.paid_amount_cents,0),'number',NEW.number,'partial',NEW.paid_amount_cents<NEW.amount_cents,'remainingCents',greatest(0,NEW.amount_cents-NEW.paid_amount_cents),'installmentId',NEW.id));
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.record_store_advance(p_installment_id uuid,p_amount_cents integer,p_paid_on date,p_request_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE parcel public.store_order_installments; existing public.store_installment_advances; entry_id uuid; new_paid integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito à administração'; END IF;
 SELECT * INTO parcel FROM public.store_order_installments WHERE id=p_installment_id FOR UPDATE;
 IF parcel.id IS NULL THEN RAISE EXCEPTION 'Parcela não encontrada'; END IF;
 SELECT * INTO existing FROM public.store_installment_advances WHERE request_id=p_request_id;
 IF existing.id IS NOT NULL THEN
  IF existing.installment_id<>p_installment_id OR existing.amount_cents<>p_amount_cents OR existing.paid_on<>p_paid_on THEN RAISE EXCEPTION 'Solicitação repetida com dados diferentes'; END IF;
  RETURN existing.id;
 END IF;
 IF parcel.paid_at IS NOT NULL OR parcel.merged_into_order_id IS NOT NULL THEN RAISE EXCEPTION 'Parcela já quitada ou transferida'; END IF;
 IF p_amount_cents IS NULL OR p_amount_cents<=0 OR p_amount_cents>parcel.amount_cents-coalesce(parcel.paid_amount_cents,0) THEN RAISE EXCEPTION 'Adiantamento deve ser positivo e não pode exceder o saldo'; END IF;
 IF p_paid_on IS NULL OR p_paid_on>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Informe uma data de recebimento válida, até hoje'; END IF;
 INSERT INTO public.store_installment_advances(installment_id,amount_cents,paid_on,request_id,created_by) VALUES(parcel.id,p_amount_cents,p_paid_on,p_request_id,auth.uid()) RETURNING id INTO entry_id;
 new_paid:=coalesce(parcel.paid_amount_cents,0)+p_amount_cents;
 PERFORM set_config('app.store_advance','yes',true);
 UPDATE public.store_order_installments SET paid_amount_cents=new_paid,paid_at=CASE WHEN new_paid>=amount_cents THEN (p_paid_on::text||'T12:00:00-03:00')::timestamptz ELSE NULL END WHERE id=parcel.id;
 PERFORM set_config('app.store_advance','no',true);
 PERFORM public.whatsapp_enqueue('advance:'||entry_id,'receipt',jsonb_build_object('phone',(SELECT client_phone FROM public.store_orders WHERE id=parcel.order_id),'advance',true,'amountCents',p_amount_cents,'remainingCents',greatest(0,parcel.amount_cents-new_paid),'dueDate',parcel.due_date,'number',parcel.number,'installmentId',parcel.id,'advanceId',entry_id));
 RETURN entry_id;
END $$;
REVOKE ALL ON FUNCTION public.record_store_advance(uuid,integer,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_store_advance(uuid,integer,date,uuid) TO authenticated;
