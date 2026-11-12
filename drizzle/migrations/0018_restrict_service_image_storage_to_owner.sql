ALTER POLICY "service images scoped read" ON storage.objects
USING (
  bucket_id = 'service-images'
  AND (SELECT auth.uid()) IS NOT NULL
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
);
COMMENT ON POLICY "service images scoped read" ON storage.objects IS
'Only upload owners and administrators can read storage objects directly. Active service photos are shared through authenticated, exact-reference server signing. https://docs.lovable.dev/features/security';