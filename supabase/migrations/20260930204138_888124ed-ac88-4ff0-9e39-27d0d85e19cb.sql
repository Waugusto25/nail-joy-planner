DROP POLICY IF EXISTS "events public read" ON public.events;
CREATE POLICY "events signed-in read" ON public.events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.events FROM anon;