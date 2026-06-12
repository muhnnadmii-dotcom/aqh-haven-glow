
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cover_path text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS cover_path text;

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  image_path text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read services" ON public.services;
DROP POLICY IF EXISTS "Admins manage services" ON public.services;
CREATE POLICY "Public read services" ON public.services FOR SELECT USING (published OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage services" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS services_touch ON public.services;
CREATE TRIGGER services_touch BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text UNIQUE NOT NULL,
  title text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_pages TO anon, authenticated;
GRANT ALL ON public.site_pages TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read site_pages" ON public.site_pages;
DROP POLICY IF EXISTS "Admins manage site_pages" ON public.site_pages;
CREATE POLICY "Public read site_pages" ON public.site_pages FOR SELECT USING (true);
CREATE POLICY "Admins manage site_pages" ON public.site_pages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS site_pages_touch ON public.site_pages;
CREATE TRIGGER site_pages_touch BEFORE UPDATE ON public.site_pages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_tanks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  tank_type text,
  dimensions text,
  volume_liters int,
  install_date date,
  image_path text,
  notes text,
  livestock text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_tanks_user_idx ON public.customer_tanks(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tanks TO authenticated;
GRANT ALL ON public.customer_tanks TO service_role;
ALTER TABLE public.customer_tanks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own tanks or staff" ON public.customer_tanks;
DROP POLICY IF EXISTS "Insert own tanks" ON public.customer_tanks;
DROP POLICY IF EXISTS "Update own tanks" ON public.customer_tanks;
DROP POLICY IF EXISTS "Delete own tanks" ON public.customer_tanks;
CREATE POLICY "Read own tanks or staff" ON public.customer_tanks FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Insert own tanks" ON public.customer_tanks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own tanks" ON public.customer_tanks FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Delete own tanks" ON public.customer_tanks FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS customer_tanks_touch ON public.customer_tanks;
CREATE TRIGGER customer_tanks_touch BEFORE UPDATE ON public.customer_tanks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.maintenance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES public.customer_tanks(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  technician text,
  actions text,
  notes text,
  overall_status text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maint_tank_idx ON public.maintenance_reports(tank_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_reports TO authenticated;
GRANT ALL ON public.maintenance_reports TO service_role;
ALTER TABLE public.maintenance_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read reports own or staff" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Staff manage reports" ON public.maintenance_reports;
CREATE POLICY "Read reports own or staff" ON public.maintenance_reports FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
  OR EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid())
);
CREATE POLICY "Staff manage reports" ON public.maintenance_reports FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
DROP TRIGGER IF EXISTS maint_touch ON public.maintenance_reports;
CREATE TRIGGER maint_touch BEFORE UPDATE ON public.maintenance_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.water_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES public.customer_tanks(id) ON DELETE CASCADE,
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  ph numeric, ammonia numeric, nitrite numeric, nitrate numeric,
  kh numeric, gh numeric, tds numeric, temperature numeric, salinity numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wt_tank_idx ON public.water_tests(tank_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_tests TO authenticated;
GRANT ALL ON public.water_tests TO service_role;
ALTER TABLE public.water_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read tests own or staff" ON public.water_tests;
DROP POLICY IF EXISTS "Staff manage tests" ON public.water_tests;
CREATE POLICY "Read tests own or staff" ON public.water_tests FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
  OR EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid())
);
CREATE POLICY "Staff manage tests" ON public.water_tests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tank_id uuid REFERENCES public.customer_tanks(id) ON DELETE SET NULL,
  kind text NOT NULL,
  preferred_date timestamptz,
  status text NOT NULL DEFAULT 'new',
  notes text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appt_user_idx ON public.appointments(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own appts or staff" ON public.appointments;
DROP POLICY IF EXISTS "Insert own appts" ON public.appointments;
DROP POLICY IF EXISTS "Update appts" ON public.appointments;
DROP POLICY IF EXISTS "Admin delete appts" ON public.appointments;
CREATE POLICY "Read own appts or staff" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Insert own appts" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update appts" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admin delete appts" ON public.appointments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS appt_touch ON public.appointments;
CREATE TRIGGER appt_touch BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins/staff read all profiles" ON public.profiles;
CREATE POLICY "Admins/staff read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "Public read media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload media" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin update media" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete media" ON storage.objects;
CREATE POLICY "Public read media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Authenticated upload media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "Owner or admin update media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Owner or admin delete media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
