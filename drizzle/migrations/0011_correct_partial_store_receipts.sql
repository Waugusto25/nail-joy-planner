CREATE OR REPLACE FUNCTION public.whatsapp_event()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p jsonb; person public.profiles; svc public.services; n integer; kind text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_settings WHERE enabled) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='appointments' THEN
 SELECT * INTO person FROM public.profiles WHERE id=NEW.client_id;
 SELECT * INTO svc FROM public.services WHERE id=NEW.service_id;
 p:=jsonb_build_object('appointmentId',NEW.id,'phone',coalesce(person.phone,NEW.guest_phone),'name',coalesce(person.full_name,NEW.guest_name),'day',NEW.day,'start',NEW.start_time,'serviceName',svc.name,'durationMinutes',svc.duration_minutes,'priceCents',NEW.price_cents,'discountPercent',NEW.discount_percent,'benefitType',NEW.benefit_type);
 IF TG_OP='INSERT' THEN kind:=CASE WHEN NEW.status='pendente' THEN 'prebooking' WHEN NEW.status='confirmado' THEN 'confirmation' ELSE NULL END;
 ELSIF NEW.status='cancelado' AND OLD.status IS DISTINCT FROM NEW.status THEN kind:=CASE WHEN NEW.cancelled_by='cliente' THEN 'client_cancelled' ELSE 'cancellation' END;
 ELSIF NEW.status='confirmado' AND (OLD.day<>NEW.day OR OLD.start_time<>NEW.start_time) THEN kind:='reschedule'; p:=p||jsonb_build_object('oldDay',OLD.day,'oldStart',OLD.start_time);
 ELSIF NEW.status='confirmado' AND OLD.status<>NEW.status THEN kind:='confirmation'; END IF;
 IF kind IS NOT NULL THEN PERFORM public.whatsapp_enqueue(NEW.id||':'||kind||':'||NEW.day||':'||NEW.start_time,kind,p); END IF;
 IF NEW.status='concluido' AND NEW.loyalty_earned AND (TG_OP='INSERT' OR OLD.status<>'concluido') THEN
 SELECT count(*) INTO n FROM public.appointments WHERE client_id=NEW.client_id AND service_id=NEW.service_id AND status='concluido' AND loyalty_earned AND day>=(now() AT TIME ZONE 'America/Sao_Paulo')::date-coalesce((SELECT benefit_expiry_days FROM public.app_settings WHERE id),90);
 IF n>0 AND n%5=0 THEN PERFORM public.whatsapp_enqueue(NEW.id||':loyalty','loyalty',p); END IF; END IF;
 ELSIF TG_TABLE_NAME='store_order_installments' THEN
 IF TG_OP='UPDATE' THEN
 IF NEW.paid_amount_cents>coalesce(OLD.paid_amount_cents,0) THEN
 p:=jsonb_build_object('phone',(SELECT client_phone FROM public.store_orders WHERE id=NEW.order_id),'amountCents',NEW.paid_amount_cents-coalesce(OLD.paid_amount_cents,0),'number',NEW.number,'partial',NEW.paid_amount_cents<NEW.amount_cents,'remainingCents',greatest(0,NEW.amount_cents-NEW.paid_amount_cents),'installmentId',NEW.id);
 PERFORM public.whatsapp_enqueue(NEW.id||':receipt:'||NEW.paid_amount_cents||':'||NEW.updated_at,'receipt',p); END IF;
 END IF;
 ELSIF TG_TABLE_NAME='reschedule_requests' AND TG_OP='INSERT' THEN
 SELECT * INTO person FROM public.profiles WHERE id=NEW.client_id;
 SELECT s.* INTO svc FROM public.services s JOIN public.appointments a ON a.service_id=s.id WHERE a.id=NEW.appointment_id;
 PERFORM public.whatsapp_enqueue(NEW.id||':request','reschedule_request',jsonb_build_object('name',person.full_name,'serviceName',svc.name,'oldDay',NEW.old_day,'oldStart',NEW.old_start_time,'newDay',NEW.requested_day,'newStart',NEW.requested_start_time,'reason',NEW.reason));
 ELSIF TG_TABLE_NAME='referrals' AND NEW.status='concluido' AND OLD.status<>'concluido' THEN
 SELECT * INTO person FROM public.profiles WHERE id=NEW.referrer_id;
 PERFORM public.whatsapp_enqueue(NEW.id||':referral','referral',jsonb_build_object('phone',person.phone,'name',person.full_name));
 ELSIF TG_TABLE_NAME='events' AND NEW.drawn_at IS NOT NULL AND (OLD.drawn_at IS NULL OR OLD.winner_id IS DISTINCT FROM NEW.winner_id) THEN
 SELECT * INTO person FROM public.profiles WHERE id=NEW.winner_id;
 PERFORM public.whatsapp_enqueue(NEW.id||':winner:'||NEW.drawn_at,'winner',jsonb_build_object('phone',person.phone,'name',person.full_name,'title',NEW.title,'prize',NEW.prize)); END IF;
 RETURN NEW;
END $function$;