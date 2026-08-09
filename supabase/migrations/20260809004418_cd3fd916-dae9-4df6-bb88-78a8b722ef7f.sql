CREATE TABLE public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_email text,
  requested_email text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_change_requests TO authenticated;
GRANT ALL ON public.email_change_requests TO service_role;

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email requests read own or admin" ON public.email_change_requests
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "email requests insert own" ON public.email_change_requests
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "email requests admin update" ON public.email_change_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "email requests admin delete" ON public.email_change_requests
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX email_change_requests_status_idx ON public.email_change_requests (status, created_at DESC);

CREATE TRIGGER update_email_change_requests_updated_at
BEFORE UPDATE ON public.email_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();