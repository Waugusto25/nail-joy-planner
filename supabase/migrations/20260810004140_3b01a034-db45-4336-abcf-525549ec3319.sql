CREATE TABLE public.reschedule_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_day date NOT NULL,
  old_start_time time NOT NULL,
  requested_day date NOT NULL,
  requested_start_time time NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reschedule_requests TO authenticated;
GRANT ALL ON public.reschedule_requests TO service_role;

ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reschedule read own or admin" ON public.reschedule_requests
  FOR SELECT TO authenticated
  USING ((client_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "reschedule insert own" ON public.reschedule_requests
  FOR INSERT TO authenticated
  WITH CHECK ((client_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "reschedule admin update" ON public.reschedule_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "reschedule admin delete" ON public.reschedule_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX reschedule_requests_status_idx ON public.reschedule_requests (status, created_at DESC);

CREATE TRIGGER update_reschedule_requests_updated_at
  BEFORE UPDATE ON public.reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();