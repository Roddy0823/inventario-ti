ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firma_path text;
ALTER TABLE public.actas ADD COLUMN IF NOT EXISTS tecnico_firma_path text;