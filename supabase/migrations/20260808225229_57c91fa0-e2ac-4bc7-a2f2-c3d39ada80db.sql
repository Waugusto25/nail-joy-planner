CREATE TABLE public.schedule_months (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_months TO authenticated;
GRANT SELECT ON public.schedule_months TO anon;
GRANT ALL ON public.schedule_months TO service_role;

ALTER TABLE public.schedule_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "months public read" ON public.schedule_months FOR SELECT USING (true);
CREATE POLICY "months admin write" ON public.schedule_months FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS max_advance_months integer NOT NULL DEFAULT 2;