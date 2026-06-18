
-- 1. Extend service_requests with assigned_to
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Extend request_notes with visibility
ALTER TABLE public.request_notes ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','public'));
ALTER TABLE public.request_notes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Extend request_status_history visibility
ALTER TABLE public.request_status_history ADD COLUMN IF NOT EXISTS is_visible_to_customer boolean NOT NULL DEFAULT true;

-- 4. New table: request_reports
CREATE TABLE IF NOT EXISTS public.request_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'general',
  body text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_visible_to_customer boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_reports TO authenticated;
GRANT ALL ON public.request_reports TO service_role;
ALTER TABLE public.request_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage reports" ON public.request_reports FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));

CREATE POLICY "Customers read visible reports on own requests" ON public.request_reports FOR SELECT TO authenticated
  USING (
    is_visible_to_customer = true
    AND EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.user_id = auth.uid())
  );

CREATE TRIGGER request_reports_touch BEFORE UPDATE ON public.request_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. New table: request_attachments
CREATE TABLE IF NOT EXISTS public.request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  related_type text NOT NULL DEFAULT 'request' CHECK (related_type IN ('request','note','report')),
  related_id uuid,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_visible_to_customer boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_attachments TO authenticated;
GRANT ALL ON public.request_attachments TO service_role;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage attachments" ON public.request_attachments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));

CREATE POLICY "Customers read visible attachments on own requests" ON public.request_attachments FOR SELECT TO authenticated
  USING (
    is_visible_to_customer = true
    AND EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.user_id = auth.uid())
  );

CREATE POLICY "Customers upload attachments on own requests" ON public.request_attachments FOR INSERT TO authenticated
  WITH CHECK (
    is_visible_to_customer = true
    AND uploaded_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.user_id = auth.uid())
  );

-- 6. Update request_notes RLS so customers can read public notes & post public comments on own requests
DROP POLICY IF EXISTS "Customers read public notes on own requests" ON public.request_notes;
CREATE POLICY "Customers read public notes on own requests" ON public.request_notes FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    AND EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Customers post public notes on own requests" ON public.request_notes;
CREATE POLICY "Customers post public notes on own requests" ON public.request_notes FOR INSERT TO authenticated
  WITH CHECK (
    visibility = 'public'
    AND author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.user_id = auth.uid())
  );

-- touch trigger for notes updated_at
DROP TRIGGER IF EXISTS request_notes_touch ON public.request_notes;
CREATE TRIGGER request_notes_touch BEFORE UPDATE ON public.request_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
