CREATE TABLE public.special_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day date NOT NULL UNIQUE,
  reason text,
  times time without time zone[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.special_days TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_days TO authenticated;
GRANT ALL ON public.special_days TO service_role;

ALTER TABLE public.special_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "special days public read" ON public.special_days FOR SELECT USING (true);
CREATE POLICY "special days admin write" ON public.special_days FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_special_days_updated_at BEFORE UPDATE ON public.special_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();