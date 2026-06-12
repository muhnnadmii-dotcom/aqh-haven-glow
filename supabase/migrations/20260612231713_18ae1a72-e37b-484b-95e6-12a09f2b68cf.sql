
-- 1) Extend customer_tanks with structured fields
ALTER TABLE public.customer_tanks
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS depth_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS filter_type text,
  ADD COLUMN IF NOT EXISTS filter_model text,
  ADD COLUMN IF NOT EXISTS has_heater boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS heater_watts integer,
  ADD COLUMN IF NOT EXISTS heater_model text,
  ADD COLUMN IF NOT EXISTS lighting_type text,
  ADD COLUMN IF NOT EXISTS lighting_hours numeric,
  ADD COLUMN IF NOT EXISTS lighting_model text,
  ADD COLUMN IF NOT EXISTS has_timer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_co2 boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS co2_type text,
  ADD COLUMN IF NOT EXISTS co2_hours numeric,
  ADD COLUMN IF NOT EXISTS livestock_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS has_plants boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS plants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS primary_image text;

-- 2) Service request status enum
DO $$ BEGIN
  CREATE TYPE public.service_request_status AS ENUM
    ('new','in_review','contacted','awaiting_customer','scheduled','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_request_type AS ENUM
    ('design','visit','consultation','maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Unified service_requests table
CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.service_request_type NOT NULL,
  tank_id uuid REFERENCES public.customer_tanks(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL,
  city text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_notes text,
  preferred_times text,
  attachments text[] NOT NULL DEFAULT ARRAY[]::text[],
  status public.service_request_status NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_requests_user_idx ON public.service_requests(user_id);
CREATE INDEX IF NOT EXISTS service_requests_type_idx ON public.service_requests(type);
CREATE INDEX IF NOT EXISTS service_requests_status_idx ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS service_requests_created_idx ON public.service_requests(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert own service request" ON public.service_requests;
CREATE POLICY "Insert own service request" ON public.service_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Read own service requests or staff" ON public.service_requests;
CREATE POLICY "Read own service requests or staff" ON public.service_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "Staff update service requests" ON public.service_requests;
CREATE POLICY "Staff update service requests" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "Admin delete service requests" ON public.service_requests;
CREATE POLICY "Admin delete service requests" ON public.service_requests
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS service_requests_touch ON public.service_requests;
CREATE TRIGGER service_requests_touch BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
