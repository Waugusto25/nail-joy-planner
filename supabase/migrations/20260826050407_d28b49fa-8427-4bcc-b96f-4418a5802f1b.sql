CREATE OR REPLACE FUNCTION public.delete_client_account(p_client uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  IF public.has_role(p_client, 'admin') THEN
    RAISE EXCEPTION 'Não é possível excluir a conta da administradora.';
  END IF;

  DELETE FROM public.appointments WHERE client_id = p_client;
  DELETE FROM public.push_subscriptions WHERE user_id = p_client;
  DELETE FROM public.referrals WHERE referrer_id = p_client OR referred_id = p_client;
  DELETE FROM public.reschedule_requests WHERE client_id = p_client;
  DELETE FROM public.email_change_requests WHERE user_id = p_client;
  DELETE FROM public.user_roles WHERE user_id = p_client;

  UPDATE public.profiles
     SET deleted_at = now(),
         phone = 'del-' || left(md5(random()::text), 10),
         auth_phone = NULL,
         access_key = gen_random_uuid()
   WHERE id = p_client;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_client_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_client_account(uuid) TO authenticated;

ALTER FUNCTION public.admin_soft_delete_client(uuid) SET search_path = public;
ALTER FUNCTION public.allocate_login_id(text) SET search_path = public;
ALTER FUNCTION public.bootstrap_my_profile(text, text, text, uuid) SET search_path = public;
ALTER FUNCTION public.busy_times(date) SET search_path = public;
ALTER FUNCTION public.busy_times_except(date, uuid) SET search_path = public;
ALTER FUNCTION public.claim_my_event_prize(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.consume_my_referral(uuid) SET search_path = public;
ALTER FUNCTION public.drop_push_subscriptions(uuid[]) SET search_path = public;
ALTER FUNCTION public.due_reminder_targets(text) SET search_path = public;
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION public.link_referral(text) SET search_path = public;
ALTER FUNCTION public.mark_reminder_sent(text, uuid) SET search_path = public;
ALTER FUNCTION public.phone_login_status(text) SET search_path = public;
ALTER FUNCTION public.phone_taken(text) SET search_path = public;
ALTER FUNCTION public.push_admin_targets() SET search_path = public;
ALTER FUNCTION public.push_client_targets(uuid) SET search_path = public;
ALTER FUNCTION public.resolve_login_id(text) SET search_path = public;
ALTER FUNCTION public.sync_my_access_key(uuid) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

DROP POLICY IF EXISTS "service images read linked or admin" ON storage.objects;
DROP POLICY IF EXISTS "service images public read" ON storage.objects;
CREATE POLICY "service images public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'service-images');
