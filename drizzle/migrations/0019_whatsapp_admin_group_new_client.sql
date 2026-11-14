-- Alertas administrativos vão para o grupo da gerência (fica como não lido em destaque).
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS admin_group_jid text NOT NULL DEFAULT '120363432472036282@g.us' CHECK (admin_group_jid = '' OR admin_group_jid ~ '^[0-9-]+@g\.us$');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.whatsapp_new_client_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.whatsapp_enqueue(NEW.id||':new_client','new_client',jsonb_build_object('name',NEW.full_name,'phone',NEW.phone,'loginId',NEW.login_id));
 RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.whatsapp_new_client_event() FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
DROP TRIGGER IF EXISTS whatsapp_new_client ON public.profiles;
--> statement-breakpoint
CREATE TRIGGER whatsapp_new_client AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.whatsapp_new_client_event();
