DROP POLICY IF EXISTS "service images signed-in read" ON storage.objects;
CREATE POLICY "service images scoped read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'service-images'
  AND (SELECT auth.uid()) IS NOT NULL
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.active AND s.image_url = storage.objects.name
    )
  )
);
COMMENT ON POLICY "service images scoped read" ON storage.objects IS
'Owners and administrators can read private service images; customers can read only images explicitly published on active services. https://docs.lovable.dev/features/security';