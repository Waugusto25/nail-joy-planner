ALTER POLICY "events signed-in read" ON public.events
USING (
  active = true
  OR winner_id = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);