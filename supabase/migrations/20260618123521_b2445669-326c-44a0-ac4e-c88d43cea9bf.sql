
-- 1. aquarium_care_logs
CREATE TABLE public.aquarium_care_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES public.customer_tanks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_type text NOT NULL CHECK (log_type IN ('status_update','water_change','note','issue','photo','reading')),
  status text CHECK (status IN ('excellent','normal','needs_attention','problem')),
  water_change_percentage numeric,
  note text,
  note_category text,
  image_paths text[] DEFAULT '{}'::text[],
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquarium_care_logs TO authenticated;
GRANT ALL ON public.aquarium_care_logs TO service_role;
ALTER TABLE public.aquarium_care_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers manage own tank logs" ON public.aquarium_care_logs FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admin staff read tank logs" ON public.aquarium_care_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE INDEX idx_care_logs_tank ON public.aquarium_care_logs(tank_id, created_at DESC);

-- 2. aquarium_readings
CREATE TABLE public.aquarium_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES public.customer_tanks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  temperature numeric, ph numeric, ammonia numeric, nitrite numeric, nitrate numeric, tds numeric,
  salinity numeric, kh numeric, calcium numeric, magnesium numeric, phosphate numeric,
  reading_date timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquarium_readings TO authenticated;
GRANT ALL ON public.aquarium_readings TO service_role;
ALTER TABLE public.aquarium_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers manage own tank readings" ON public.aquarium_readings FOR ALL TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid()));
CREATE POLICY "Admin staff read tank readings" ON public.aquarium_readings FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE INDEX idx_readings_tank ON public.aquarium_readings(tank_id, reading_date DESC);

-- 3. aquarium_issues
CREATE TABLE public.aquarium_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES public.customer_tanks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  wants_followup boolean NOT NULL DEFAULT false,
  image_paths text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquarium_issues TO authenticated;
GRANT ALL ON public.aquarium_issues TO service_role;
ALTER TABLE public.aquarium_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers manage own tank issues" ON public.aquarium_issues FOR ALL TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid()));
CREATE POLICY "Admin staff read tank issues" ON public.aquarium_issues FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE INDEX idx_issues_tank ON public.aquarium_issues(tank_id, created_at DESC);
CREATE TRIGGER touch_aquarium_issues BEFORE UPDATE ON public.aquarium_issues
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. aquarium_tasks
CREATE TABLE public.aquarium_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES public.customer_tanks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  title text NOT NULL,
  due_date timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquarium_tasks TO authenticated;
GRANT ALL ON public.aquarium_tasks TO service_role;
ALTER TABLE public.aquarium_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers manage own tank tasks" ON public.aquarium_tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = tank_id AND t.user_id = auth.uid()));
CREATE POLICY "Admin staff read tank tasks" ON public.aquarium_tasks FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE INDEX idx_tasks_tank ON public.aquarium_tasks(tank_id, due_date);
