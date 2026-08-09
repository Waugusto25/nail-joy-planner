ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS calendar_prompt_dismissed boolean NOT NULL DEFAULT false;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS instagram_url text NOT NULL DEFAULT 'https://www.instagram.com/jannah_silvaah?igsh=OTRoZjFka2p0dDhn',
  ADD COLUMN IF NOT EXISTS whatsapp_number text NOT NULL DEFAULT '5535998844504';