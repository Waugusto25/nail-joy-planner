ALTER TABLE public.store_order_installments
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS mp_method text CHECK (mp_method IN ('pix','boleto')),
  ADD COLUMN IF NOT EXISTS mp_status text,
  ADD COLUMN IF NOT EXISTS pix_copia_e_cola text,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS boleto_linha_digitavel text,
  ADD COLUMN IF NOT EXISTS boleto_pdf_url text;