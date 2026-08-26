-- 1. Colunas novas -----------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_key uuid,
  ADD COLUMN IF NOT EXISTS auth_phone text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.profiles SET auth_phone = phone WHERE auth_phone IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_phone text;

CREATE INDEX IF NOT EXISTS appointments_guest_phone_idx ON public.appointments (guest_phone);
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles (phone);

-- 2. Token de serviço para o cron de lembretes -------------------------------
CREATE TABLE IF NOT EXISTS public.service_tokens (
  name text PRIMARY KEY,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.service_tokens TO service_role;
ALTER TABLE public.service_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.service_tokens (name) VALUES ('reminders') ON CONFLICT (name) DO NOTHING;

-- 3. Políticas que substituem o bypass de RLS --------------------------------
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "appointments insert own" ON public.appointments;
CREATE POLICY "appointments insert own" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. Funções seguras ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_login_id(p_full_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base text;
  v_candidate text;
  i int := 0;
BEGIN
  v_base := regexp_replace(
    translate(coalesce(nullif(btrim(p_full_name), ''), 'Cliente'),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Za-z0-9]', '', 'g');
  IF v_base = '' THEN v_base := 'Cliente'; END IF;
  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(login_id) = lower(v_candidate)) LOOP
    i := i + 1;
    v_candidate := v_base || (100 + floor(random() * 900))::int::text;
    IF i > 60 THEN
      v_candidate := v_base || to_char(clock_timestamp(), 'SSMS');
      EXIT;
    END IF;
  END LOOP;
  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.phone_login_status(p_phone text)
RETURNS TABLE (
  registered boolean,
  is_admin boolean,
  has_referral boolean,
  login_id text,
  full_name text,
  access_key uuid,
  auth_phone text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_row public.profiles;
BEGIN
  IF length(v_digits) < 10 THEN
    RETURN QUERY SELECT false, false, false, NULL::text, NULL::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  SELECT * INTO v_row FROM public.profiles
   WHERE phone = v_digits AND deleted_at IS NULL LIMIT 1;
  IF v_row.id IS NULL THEN
    RETURN QUERY SELECT false, false, false, NULL::text, NULL::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT
    true,
    public.has_role(v_row.id, 'admin'),
    EXISTS (SELECT 1 FROM public.referrals r WHERE r.referred_id = v_row.id),
    v_row.login_id,
    v_row.full_name,
    v_row.access_key,
    coalesce(v_row.auth_phone, v_row.phone);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_login_id(p_identifier text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slug text := regexp_replace(coalesce(p_identifier, ''), '[^A-Za-z0-9]', '', 'g');
  v_login text;
  v_count int;
BEGIN
  SELECT login_id INTO v_login FROM public.profiles
   WHERE lower(login_id) = lower(v_slug) AND deleted_at IS NULL LIMIT 1;
  IF v_login IS NOT NULL THEN RETURN v_login; END IF;
  SELECT count(*) INTO v_count FROM public.profiles
   WHERE lower(full_name) = lower(btrim(coalesce(p_identifier, ''))) AND deleted_at IS NULL;
  IF v_count = 1 THEN
    SELECT login_id INTO v_login FROM public.profiles
     WHERE lower(full_name) = lower(btrim(p_identifier)) AND deleted_at IS NULL LIMIT 1;
    RETURN v_login;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_my_profile(
  p_full_name text, p_login_id text, p_phone text, p_access_key uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão ausente.'; END IF;
  INSERT INTO public.profiles (id, full_name, login_id, phone, auth_phone, access_key)
  VALUES (v_uid, btrim(p_full_name), p_login_id, v_digits, v_digits, p_access_key)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        access_key = EXCLUDED.access_key;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'client') ON CONFLICT (user_id, role) DO NOTHING;
  -- Vincula atendimentos avulsos criados pela administradora antes da conta existir.
  UPDATE public.appointments
     SET client_id = v_uid, guest_phone = NULL, guest_name = NULL
   WHERE client_id IS NULL AND guest_phone = v_digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_my_access_key(p_key uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente.'; END IF;
  UPDATE public.profiles
     SET access_key = p_key, auth_phone = phone
   WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.phone_taken(p_phone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE phone = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
       AND deleted_at IS NULL
       AND id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

CREATE OR REPLACE FUNCTION public.link_referral(p_referrer_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_referrer_phone, ''), '\D', '', 'g');
  v_referrer uuid;
  v_enabled boolean;
BEGIN
  IF v_uid IS NULL OR length(v_digits) < 10 THEN RETURN false; END IF;
  SELECT referral_enabled INTO v_enabled FROM public.app_settings WHERE id LIMIT 1;
  IF NOT coalesce(v_enabled, true) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_uid) THEN RETURN false; END IF;
  SELECT id INTO v_referrer FROM public.profiles
   WHERE phone = v_digits AND deleted_at IS NULL AND id <> v_uid LIMIT 1;
  IF v_referrer IS NULL THEN RETURN false; END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, status)
  VALUES (v_referrer, v_uid, 'pendente');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_my_referral(p_appointment uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_coupon uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão ausente.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE id = p_appointment AND client_id = v_uid) THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;
  SELECT id INTO v_coupon FROM public.referrals
   WHERE referrer_id = v_uid AND status = 'concluido' AND used_at IS NULL AND expires_at > now()
   ORDER BY earned_at ASC LIMIT 1;
  IF v_coupon IS NULL THEN RAISE EXCEPTION 'Você não tem cupom de indicação disponível.'; END IF;
  UPDATE public.referrals SET used_at = now(), used_appointment_id = p_appointment WHERE id = v_coupon;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_my_event_prize(p_event uuid, p_appointment uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.events;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão ausente.'; END IF;
  SELECT * INTO v_row FROM public.events WHERE id = p_event;
  IF v_row.id IS NULL OR v_row.winner_id <> v_uid THEN
    RAISE EXCEPTION 'Você não é a ganhadora deste evento.';
  END IF;
  IF v_row.prize_claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Este prêmio já foi reivindicado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE id = p_appointment AND client_id = v_uid) THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;
  UPDATE public.events
     SET prize_claimed_at = now(), prize_claimed_appointment_id = p_appointment
   WHERE id = p_event;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.busy_times(p_day date)
RETURNS TABLE (start_time time, duration_minutes int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.start_time, coalesce(s.duration_minutes, 60)::int
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
   WHERE a.day = p_day
     AND a.status IN ('pendente', 'confirmado', 'concluido');
$$;

CREATE OR REPLACE FUNCTION public.push_admin_targets()
RETURNS TABLE (id uuid, endpoint text, p256dh text, auth text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.endpoint, p.p256dh, p.auth
    FROM public.push_subscriptions p
   WHERE auth.uid() IS NOT NULL
     AND public.has_role(p.user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.push_client_targets(p_client uuid)
RETURNS TABLE (id uuid, endpoint text, p256dh text, auth text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.endpoint, p.p256dh, p.auth
    FROM public.push_subscriptions p
   WHERE p.user_id = p_client
     AND (public.has_role(auth.uid(), 'admin') OR auth.uid() = p_client);
$$;

CREATE OR REPLACE FUNCTION public.drop_push_subscriptions(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.push_subscriptions WHERE id = ANY (p_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.due_reminder_targets(p_token text)
RETURNS TABLE (
  appointment_id uuid, day date, start_time time, service_name text,
  subscription_id uuid, endpoint text, p256dh text, auth text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.service_tokens t
     WHERE t.name = 'reminders' AND t.token::text = coalesce(p_token, '')
  ) THEN
    RAISE EXCEPTION 'Token inválido.';
  END IF;
  RETURN QUERY
    SELECT a.id, a.day, a.start_time, s.name, ps.id, ps.endpoint, ps.p256dh, ps.auth
      FROM public.appointments a
      LEFT JOIN public.services s ON s.id = a.service_id
      LEFT JOIN public.push_subscriptions ps ON ps.user_id = a.client_id
     WHERE a.status = 'confirmado'
       AND a.reminder_sent_at IS NULL
       AND a.client_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_reminder_sent(p_token text, p_appointment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.service_tokens t
     WHERE t.name = 'reminders' AND t.token::text = coalesce(p_token, '')
  ) THEN
    RAISE EXCEPTION 'Token inválido.';
  END IF;
  UPDATE public.appointments SET reminder_sent_at = now() WHERE id = p_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_soft_delete_client(p_client uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
  IF public.has_role(p_client, 'admin') THEN
    RAISE EXCEPTION 'Não é possível excluir a conta da administradora.';
  END IF;
  DELETE FROM public.appointments WHERE client_id = p_client;
  DELETE FROM public.push_subscriptions WHERE user_id = p_client;
  DELETE FROM public.referrals WHERE referrer_id = p_client OR referred_id = p_client;
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

-- 5. Permissões de execução --------------------------------------------------
REVOKE ALL ON FUNCTION public.allocate_login_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.phone_login_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_login_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_my_profile(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_my_access_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.phone_taken(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_referral(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_my_referral(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_my_event_prize(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.busy_times(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.push_admin_targets() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.push_client_targets(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.drop_push_subscriptions(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.due_reminder_targets(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_reminder_sent(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_soft_delete_client(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.allocate_login_id(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_login_status(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_id(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_my_profile(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_my_access_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phone_taken(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_my_referral(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_my_event_prize(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.busy_times(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_admin_targets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_client_targets(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drop_push_subscriptions(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.due_reminder_targets(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_reminder_sent(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_client(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_soft_delete_client(uuid) TO service_role;