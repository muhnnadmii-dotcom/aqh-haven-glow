
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS appointments_service_request_id_idx ON public.appointments(service_request_id);

CREATE TABLE IF NOT EXISTS public.request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_notes TO authenticated;
GRANT ALL ON public.request_notes TO service_role;
ALTER TABLE public.request_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read request notes" ON public.request_notes FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "Staff write request notes" ON public.request_notes FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "Staff update request notes" ON public.request_notes FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "Admins delete request notes" ON public.request_notes FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE INDEX IF NOT EXISTS request_notes_request_id_idx ON public.request_notes(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.request_status_history TO authenticated;
GRANT ALL ON public.request_status_history TO service_role;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read status history" ON public.request_status_history FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "Staff write status history" ON public.request_status_history FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE INDEX IF NOT EXISTS request_status_history_request_id_idx ON public.request_status_history(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read customer notes" ON public.customer_notes FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "Staff write customer notes" ON public.customer_notes FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "Staff update customer notes" ON public.customer_notes FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "Admins delete customer notes" ON public.customer_notes FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE INDEX IF NOT EXISTS customer_notes_profile_id_idx ON public.customer_notes(profile_id, created_at DESC);
