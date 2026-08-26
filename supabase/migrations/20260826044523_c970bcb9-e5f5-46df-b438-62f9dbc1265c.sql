CREATE OR REPLACE FUNCTION public.busy_times_except(p_day date, p_exclude uuid)
RETURNS TABLE(start_time time without time zone, duration_minutes integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.start_time, coalesce(s.duration_minutes, 60)::int
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
   WHERE a.day = p_day
     AND a.id IS DISTINCT FROM p_exclude
     AND a.status IN ('pendente', 'confirmado', 'concluido');
$$;

REVOKE ALL ON FUNCTION public.busy_times_except(date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.busy_times_except(date, uuid) TO anon, authenticated, service_role;