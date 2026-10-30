CREATE TABLE public.whatsapp_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false,api_url text NOT NULL DEFAULT '',instance_name text NOT NULL DEFAULT 'JannahNails',activated_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.whatsapp_settings TO authenticated;
GRANT ALL ON public.whatsapp_settings TO service_role;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_settings_admin ON public.whatsapp_settings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.whatsapp_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_key text NOT NULL UNIQUE,kind text NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','skipped')),attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_messages_admin ON public.whatsapp_messages FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE INDEX whatsapp_messages_pending_idx ON public.whatsapp_messages(status,available_at);
CREATE FUNCTION public.whatsapp_authorize(p_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.service_tokens WHERE name='reminders' AND token::text=coalesce(p_token,'')) THEN RAISE EXCEPTION 'Acesso restrito'; END IF; END $$;
REVOKE ALL ON FUNCTION public.whatsapp_authorize(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.whatsapp_enqueue(p_key text,p_kind text,p_payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.whatsapp_settings WHERE enabled) THEN RETURN; END IF; INSERT INTO public.whatsapp_messages(event_key,kind,payload) VALUES(p_key,p_kind,p_payload) ON CONFLICT(event_key) DO NOTHING; END $$;
REVOKE ALL ON FUNCTION public.whatsapp_enqueue(text,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.whatsapp_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 IF NEW.paid_amount_cents>coalesce(OLD.paid_amount_cents,0) AND (NEW.paid_at IS NOT NULL OR NEW.paid_amount_cents<NEW.amount_cents) THEN
 p:=jsonb_build_object('phone',(SELECT client_phone FROM public.store_orders WHERE id=NEW.order_id),'amountCents',NEW.paid_amount_cents-coalesce(OLD.paid_amount_cents,0),'number',NEW.number,'partial',NEW.paid_at IS NULL,'installmentId',NEW.id);
 PERFORM public.whatsapp_enqueue(NEW.id||':receipt:'||NEW.paid_amount_cents||':'||NEW.updated_at,'receipt',p); END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER whatsapp_appointments AFTER INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.whatsapp_event();
CREATE TRIGGER whatsapp_installments AFTER UPDATE ON public.store_order_installments FOR EACH ROW EXECUTE FUNCTION public.whatsapp_event();
CREATE TRIGGER whatsapp_reschedule AFTER INSERT ON public.reschedule_requests FOR EACH ROW EXECUTE FUNCTION public.whatsapp_event();
CREATE TRIGGER whatsapp_referrals AFTER UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.whatsapp_event();
CREATE TRIGGER whatsapp_events AFTER UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.whatsapp_event();
CREATE FUNCTION public.whatsapp_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM net.http_post(url:='https://project--f96d0623-3d94-4c29-b904-ecb9c33dfe92.lovable.app/api/public/hooks/whatsapp',headers:=jsonb_build_object('Content-Type','application/json','x-service-token',(SELECT token::text FROM public.service_tokens WHERE name='reminders')),body:='{}'::jsonb); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.whatsapp_wake() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER whatsapp_wake AFTER INSERT ON public.whatsapp_messages FOR EACH STATEMENT EXECUTE FUNCTION public.whatsapp_wake();
CREATE FUNCTION public.whatsapp_claim(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE result jsonb; BEGIN
 PERFORM public.whatsapp_authorize(p_token);
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_settings WHERE enabled) THEN RETURN jsonb_build_object('enabled',false,'messages','[]'::jsonb); END IF;
 WITH selected AS (SELECT id FROM public.whatsapp_messages WHERE (status='pending' OR (status='sending' AND updated_at<now()-interval '10 minutes')) AND available_at<=now() AND attempts<4 ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED),claimed AS (UPDATE public.whatsapp_messages m SET status='sending',attempts=attempts+1,updated_at=now() FROM selected s WHERE m.id=s.id RETURNING m.*) SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO result FROM claimed c;
 RETURN jsonb_build_object('enabled',true,'settings',(SELECT to_jsonb(s) FROM public.whatsapp_settings s WHERE id),'adminPhone',(SELECT whatsapp_number FROM public.app_settings WHERE id),'pixKey',(SELECT pix_key FROM public.app_settings WHERE id),'messages',result); END $$;
REVOKE ALL ON FUNCTION public.whatsapp_claim(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_claim(text) TO anon,authenticated,service_role;
CREATE FUNCTION public.whatsapp_finish(p_token text,p_id uuid,p_status text,p_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM public.whatsapp_authorize(p_token);
 IF p_status NOT IN ('sent','failed','skipped') THEN RAISE EXCEPTION 'Status inválido'; END IF;
 UPDATE public.whatsapp_messages SET status=CASE WHEN p_status='failed' AND attempts<4 THEN 'pending' ELSE p_status END,sent_at=CASE WHEN p_status='sent' THEN now() END,last_error=left(p_error,200),available_at=now()+interval '1 hour',updated_at=now() WHERE id=p_id AND status='sending';
 IF EXISTS(SELECT 1 FROM public.whatsapp_messages WHERE status IN ('pending','sending')) THEN
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='jannah-whatsapp-retry') THEN PERFORM cron.schedule('jannah-whatsapp-retry','0 * * * *',$job$ SELECT net.http_post(url:='https://project--f96d0623-3d94-4c29-b904-ecb9c33dfe92.lovable.app/api/public/hooks/whatsapp',headers:=jsonb_build_object('Content-Type','application/json','x-service-token',(SELECT token::text FROM public.service_tokens WHERE name='reminders')),body:='{}'::jsonb); $job$); END IF;
 ELSE PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='jannah-whatsapp-retry'; END IF; END $$;
REVOKE ALL ON FUNCTION public.whatsapp_finish(text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_finish(text,uuid,text,text) TO anon,authenticated,service_role;
CREATE FUNCTION public.whatsapp_prepare_reminders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a record;p record;today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_settings WHERE enabled) THEN RETURN; END IF;
 FOR a IN SELECT a.*,coalesce(c.phone,a.guest_phone) phone FROM public.appointments a LEFT JOIN public.profiles c ON c.id=a.client_id WHERE a.status='confirmado' AND a.day=today+1 LOOP PERFORM public.whatsapp_enqueue(a.id||':reminder:'||a.day||':'||a.start_time,'reminder',jsonb_build_object('phone',a.phone,'appointmentId',a.id,'day',a.day,'start',a.start_time)); END LOOP;
 FOR p IN SELECT i.*,o.client_phone FROM public.store_order_installments i JOIN public.store_orders o ON o.id=i.order_id WHERE i.due_date=today-1 AND i.paid_at IS NULL AND i.merged_into_order_id IS NULL AND o.archived_at IS NULL AND i.amount_cents>coalesce(i.paid_amount_cents,0) LOOP PERFORM public.whatsapp_enqueue(p.id||':due:'||p.due_date,'due',jsonb_build_object('phone',p.client_phone,'installmentId',p.id,'dueDate',p.due_date,'number',p.number,'amountCents',p.amount_cents-coalesce(p.paid_amount_cents,0))); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.whatsapp_prepare_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_prepare_reminders() TO service_role;
CREATE FUNCTION public.whatsapp_delivery_valid(p_token text,p_kind text,p_payload jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM public.whatsapp_authorize(p_token);
 IF p_kind IN ('reminder','confirmation','reschedule') THEN RETURN EXISTS(SELECT 1 FROM public.appointments WHERE id=(p_payload->>'appointmentId')::uuid AND status='confirmado' AND day=(p_payload->>'day')::date AND start_time=(p_payload->>'start')::time); END IF;
 IF p_kind='due' THEN RETURN EXISTS(SELECT 1 FROM public.store_order_installments WHERE id=(p_payload->>'installmentId')::uuid AND paid_at IS NULL AND amount_cents>coalesce(paid_amount_cents,0)); END IF; RETURN true; END $$;
REVOKE ALL ON FUNCTION public.whatsapp_delivery_valid(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_delivery_valid(text,text,jsonb) TO anon,authenticated,service_role;
CREATE FUNCTION public.whatsapp_admin_enqueue(p_kind text,p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.profiles; BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 IF p_kind NOT IN ('welcome','contact') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=p_id AND deleted_at IS NULL;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrada'; END IF;
 PERFORM public.whatsapp_enqueue(p_id||':'||p_kind||':'||CASE WHEN p_kind='welcome' THEN 'once' ELSE now()::text END,p_kind,jsonb_build_object('phone',p.phone,'name',p.full_name,'loginId',p.login_id)); END $$;
REVOKE ALL ON FUNCTION public.whatsapp_admin_enqueue(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_admin_enqueue(text,uuid) TO authenticated;
CREATE FUNCTION public.settle_verified_mp(p_token text,p_payment_id text,p_reference uuid,p_status text,p_amount_cents integer,p_approved_at timestamptz) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.store_order_installments;fee integer;expected integer; BEGIN
 PERFORM public.whatsapp_authorize(p_token);
 SELECT * INTO p FROM public.store_order_installments WHERE mp_payment_id=p_payment_id FOR UPDATE;
 IF p.id IS NULL THEN RETURN 'not_found'; END IF;
 IF p_reference IS NOT NULL AND p.id<>p_reference THEN RAISE EXCEPTION 'Pagamento não corresponde à parcela'; END IF;
 IF p_status<>'approved' THEN UPDATE public.store_order_installments SET mp_status=p_status WHERE id=p.id; RETURN 'pending'; END IF;
 IF p.paid_at IS NOT NULL THEN UPDATE public.store_order_installments SET mp_status='approved' WHERE id=p.id; RETURN 'already_paid'; END IF;
 fee:=CASE WHEN p.mp_method='boleto' THEN 349 ELSE 0 END;
 expected:=greatest(0,p.amount_cents-coalesce(p.paid_amount_cents,0));
 IF p_amount_cents-fee<>expected OR expected<=0 THEN RAISE EXCEPTION 'Valor recebido diverge do saldo da parcela'; END IF;
 UPDATE public.store_order_installments SET mp_status='approved',paid_at=coalesce(p_approved_at,now()),paid_amount_cents=coalesce(p.paid_amount_cents,0)+expected WHERE id=p.id;
 RETURN 'paid'; END $$;
REVOKE ALL ON FUNCTION public.settle_verified_mp(text,text,uuid,text,integer,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_verified_mp(text,text,uuid,text,integer,timestamptz) TO anon,authenticated,service_role;