ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS loyalty_earned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS loyalty_spent_at timestamptz,
  ADD COLUMN IF NOT EXISTS loyalty_spent_on uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_loyalty_wallet_idx
  ON public.appointments (client_id, service_id, loyalty_earned, loyalty_spent_at);

UPDATE public.appointments a
SET loyalty_earned = true,
    loyalty_expires_at = (a.day::timestamptz + interval '90 days')
FROM public.services s
WHERE s.id = a.service_id
  AND s.loyalty_eligible = true
  AND a.status = 'concluido'
  AND a.loyalty_earned = false;