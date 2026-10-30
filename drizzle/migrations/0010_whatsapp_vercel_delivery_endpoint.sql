CREATE OR REPLACE FUNCTION public.whatsapp_wake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.whatsapp_messages WHERE status='pending') THEN
  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='jannah-whatsapp-retry') THEN
   PERFORM cron.schedule('jannah-whatsapp-retry','0 * * * *',$job$ SELECT net.http_post(url:='https://www.jannahnails.com/api/public/hooks/whatsapp',headers:=jsonb_build_object('Content-Type','application/json','x-service-token',(SELECT token::text FROM public.service_tokens WHERE name='reminders')),body:='{}'::jsonb); $job$);
  END IF;
  PERFORM net.http_post(url:='https://www.jannahnails.com/api/public/hooks/whatsapp',headers:=jsonb_build_object('Content-Type','application/json','x-service-token',(SELECT token::text FROM public.service_tokens WHERE name='reminders')),body:='{}'::jsonb);
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.whatsapp_finish(p_token text,p_id uuid,p_status text,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.whatsapp_authorize(p_token);
 IF p_status NOT IN ('sent','failed','skipped') THEN RAISE EXCEPTION 'Status inválido'; END IF;
 UPDATE public.whatsapp_messages SET status=CASE WHEN p_status='failed' AND attempts<4 THEN 'pending' ELSE p_status END,sent_at=CASE WHEN p_status='sent' THEN now() END,last_error=left(p_error,200),available_at=now()+interval '1 hour',updated_at=now() WHERE id=p_id AND status='sending';
 IF EXISTS(SELECT 1 FROM public.whatsapp_messages WHERE status IN ('pending','sending')) THEN
  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='jannah-whatsapp-retry') THEN
   PERFORM cron.schedule('jannah-whatsapp-retry','0 * * * *',$job$ SELECT net.http_post(url:='https://www.jannahnails.com/api/public/hooks/whatsapp',headers:=jsonb_build_object('Content-Type','application/json','x-service-token',(SELECT token::text FROM public.service_tokens WHERE name='reminders')),body:='{}'::jsonb); $job$);
  END IF;
 ELSE
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='jannah-whatsapp-retry';
 END IF;
END $$;