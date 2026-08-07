CREATE POLICY "service images read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-images');
CREATE POLICY "service images admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "service images admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'service-images' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'service-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "service images admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));