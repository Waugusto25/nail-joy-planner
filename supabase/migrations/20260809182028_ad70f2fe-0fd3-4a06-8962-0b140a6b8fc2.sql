-- store_orders: admin-only by design; remove anon access entirely
REVOKE ALL ON public.store_orders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_orders TO authenticated;
GRANT ALL ON public.store_orders TO service_role;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

-- verification_codes: OTP data, server-side only
REVOKE ALL ON public.verification_codes FROM anon;
REVOKE ALL ON public.verification_codes FROM authenticated;
GRANT ALL ON public.verification_codes TO service_role;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes FORCE ROW LEVEL SECURITY;