ALTER TABLE public.services ADD COLUMN IF NOT EXISTS loyalty_eligible boolean NOT NULL DEFAULT true;

CREATE TABLE public.schedule_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.schedule_breaks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_breaks TO authenticated;
GRANT ALL ON public.schedule_breaks TO service_role;

ALTER TABLE public.schedule_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breaks public read" ON public.schedule_breaks FOR SELECT USING (true);
CREATE POLICY "breaks admin write" ON public.schedule_breaks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));