CREATE OR REPLACE FUNCTION public.phone_match_key(p_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  IF length(v) >= 12 AND left(v, 2) = '55' THEN v := substr(v, 3); END IF;
  IF length(v) < 10 THEN RETURN NULL; END IF;
  RETURN left(v, 2) || '-' || right(v, 8);
END;
$$;
GRANT EXECUTE ON FUNCTION public.phone_match_key(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.phone_login_status(p_phone text)
RETURNS TABLE (registered boolean, is_admin boolean, has_referral boolean, login_id text, full_name text, access_key uuid, auth_phone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_row public.profiles;
BEGIN
  IF length(v_digits) < 10 THEN
    RETURN QUERY SELECT false, false, false, NULL::text, NULL::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  -- 1º: igualdade exata (comportamento original); 2º: mesmo DDD + 8 últimos dígitos (com/sem o 9).
  SELECT * INTO v_row FROM public.profiles WHERE phone = v_digits AND deleted_at IS NULL LIMIT 1;
  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.profiles
     WHERE public.phone_match_key(phone) = public.phone_match_key(v_digits) AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1;
  END IF;
  IF v_row.id IS NULL THEN
    RETURN QUERY SELECT false, false, false, NULL::text, NULL::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, public.has_role(v_row.id, 'admin'),
    EXISTS (SELECT 1 FROM public.referrals r WHERE r.referred_id = v_row.id),
    v_row.login_id, v_row.full_name, v_row.access_key, coalesce(v_row.auth_phone, v_row.phone);
END;
$$;