CREATE TABLE IF NOT EXISTS public.aqh_business_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text DEFAULT 'Aqua Haven',
  company_sub text DEFAULT 'تصميم وتنفيذ الأحواض الفاخرة',
  vat_number text DEFAULT '312327536500003',
  phone text DEFAULT '0552700442',
  email text DEFAULT 'info@aquahaven.sa',
  logo_url text,
  default_vat_rate numeric DEFAULT 15,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.aqh_business_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_business_settings TO authenticated;
GRANT ALL ON public.aqh_business_settings TO service_role;

ALTER TABLE public.aqh_business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aqh_settings_read" ON public.aqh_business_settings;
DROP POLICY IF EXISTS "aqh_settings_write" ON public.aqh_business_settings;

CREATE POLICY "aqh_settings_read" ON public.aqh_business_settings
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role) OR private.has_any_finance_role(auth.uid()));

CREATE POLICY "aqh_settings_write" ON public.aqh_business_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'finance_manage'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'finance_manage'::public.app_role));

CREATE OR REPLACE TRIGGER trg_aqh_business_settings_updated
  BEFORE UPDATE ON public.aqh_business_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();