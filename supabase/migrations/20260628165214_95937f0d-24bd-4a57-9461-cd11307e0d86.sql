ALTER TABLE public.aqh_products ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE public.aqh_products ADD COLUMN IF NOT EXISTS salla_raw jsonb;
ALTER TABLE public.aqh_products ADD COLUMN IF NOT EXISTS all_images jsonb DEFAULT '[]'::jsonb;
TRUNCATE TABLE public.aqh_products RESTART IDENTITY CASCADE;