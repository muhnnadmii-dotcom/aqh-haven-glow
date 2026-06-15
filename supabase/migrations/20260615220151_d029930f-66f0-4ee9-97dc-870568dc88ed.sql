
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS length_cm numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS volume_liters numeric,
  ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'range';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_price_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_price_type_check
  CHECK (price_type IN ('fixed','from','range','on_request','hidden'));
