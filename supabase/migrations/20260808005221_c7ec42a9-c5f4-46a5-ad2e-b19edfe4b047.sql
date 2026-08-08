DROP POLICY IF EXISTS "service images read" ON storage.objects;

CREATE POLICY "service images read linked or admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'service-images'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.services s WHERE s.image_url = storage.objects.name
    )
  )
);