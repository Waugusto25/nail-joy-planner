CREATE TYPE public.app_role AS ENUM ('admin', 'client');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  login_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  welcome_seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read" ON public.services FOR SELECT USING (true);
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'outros',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalogs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogs TO authenticated;
GRANT ALL ON public.catalogs TO service_role;
ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalogs public read" ON public.catalogs FOR SELECT USING (true);
CREATE POLICY "catalogs admin write" ON public.catalogs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (weekday, start_time)
);
GRANT SELECT ON public.schedule_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_slots TO authenticated;
GRANT ALL ON public.schedule_slots TO service_role;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots public read" ON public.schedule_slots FOR SELECT USING (true);
CREATE POLICY "slots admin write" ON public.schedule_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day DATE NOT NULL UNIQUE,
  reason TEXT
);
GRANT SELECT ON public.blocked_dates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_dates TO authenticated;
GRANT ALL ON public.blocked_dates TO service_role;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked public read" ON public.blocked_dates FOR SELECT USING (true);
CREATE POLICY "blocked admin write" ON public.blocked_dates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  day DATE NOT NULL,
  start_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  discount_applied BOOLEAN NOT NULL DEFAULT false,
  price_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments read" ON public.appointments FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "appointments insert own" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "appointments update" ON public.appointments FOR UPDATE TO authenticated
  USING (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "appointments delete" ON public.appointments FOR DELETE TO authenticated
  USING (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup',
  consumed BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '15 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.verification_codes TO service_role;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

INSERT INTO public.services (name, price_cents, duration_minutes, sort_order) VALUES
  ('Unha Mão', 2500, 60, 1),
  ('Pé e Mão', 5000, 120, 2),
  ('Unha Pé', 3000, 60, 3),
  ('Apenas Esmaltação', 2000, 30, 4);

INSERT INTO public.schedule_slots (weekday, start_time)
SELECT d, t FROM generate_series(1, 5) AS d,
  unnest(ARRAY['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00']::time[]) AS t;

DO $$
DECLARE admin_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'jannahsilva@jannahnails.app', extensions.crypt('27082018@#', extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Janaina Silva"}'::jsonb);
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), admin_id, admin_id::text, json_build_object('sub', admin_id::text, 'email', 'jannahsilva@jannahnails.app')::jsonb, 'email', now(), now(), now());
  INSERT INTO public.profiles (id, full_name, login_id, phone, welcome_seen)
  VALUES (admin_id, 'Janaina Silva', 'JannahSilva', '35998844504', true);
  INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin');
END $$;