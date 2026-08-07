REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;