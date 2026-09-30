DROP POLICY IF EXISTS "service images public read" ON storage.objects;
CREATE POLICY "service images signed-in read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'service-images' AND auth.uid() IS NOT NULL);