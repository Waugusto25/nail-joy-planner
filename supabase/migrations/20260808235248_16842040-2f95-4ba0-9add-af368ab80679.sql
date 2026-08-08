ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS prize_claimed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS prize_claimed_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;