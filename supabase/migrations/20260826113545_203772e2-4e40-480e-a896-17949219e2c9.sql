CREATE OR REPLACE FUNCTION public.delete_client_account(p_client uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  IF p_client = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta.';
  END IF;

  IF public.has_role(p_client, 'admin') THEN
    RAISE EXCEPTION 'Não é possível excluir a conta da administradora.';
  END IF;

  -- Remove permissões e sessões/dispositivos do aplicativo primeiro.
  DELETE FROM public.push_subscriptions WHERE user_id = p_client;
  DELETE FROM public.user_roles WHERE user_id = p_client;

  -- Limpa pendências administrativas que manteriam a cliente ativa em listas.
  DELETE FROM public.reschedule_requests WHERE client_id = p_client;
  DELETE FROM public.email_change_requests WHERE user_id = p_client;

  -- Mantém o histórico financeiro/agenda sem deixar a cliente acessar a conta.
  UPDATE public.appointments
     SET status = CASE
           WHEN status IN ('pendente', 'confirmado') THEN 'cancelado'
           ELSE status
         END,
         cancelled_at = coalesce(cancelled_at, now()),
         cancelled_by = coalesce(cancelled_by, 'admin'),
         client_hidden_at = coalesce(client_hidden_at, now())
   WHERE client_id = p_client;

  -- Desativa o perfil e troca credenciais internas para impedir novo login.
  UPDATE public.profiles
     SET deleted_at = coalesce(deleted_at, now()),
         phone = 'del-' || left(md5(p_client::text || clock_timestamp()::text), 24),
         auth_phone = NULL,
         access_key = gen_random_uuid()
   WHERE id = p_client;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrada.';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_client_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_client_account(uuid) TO authenticated;