ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS client_hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_hidden_at timestamptz;