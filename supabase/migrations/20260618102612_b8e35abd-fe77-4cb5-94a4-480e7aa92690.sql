
-- 1. New enum for assignment status
DO $$ BEGIN
  CREATE TYPE public.assignment_status AS ENUM ('unassigned','assigned','accepted','transferred');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. profiles: friendly display name shown to customers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name_for_customer text;

-- 3. service_requests: new assignment fields (status untouched)
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS assigned_to_staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assignment_status public.assignment_status NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS accepted_by_staff_at timestamptz,
  ADD COLUMN IF NOT EXISTS assignment_department text,
  ADD COLUMN IF NOT EXISTS assignment_note text;

CREATE INDEX IF NOT EXISTS idx_sr_assigned_to_staff ON public.service_requests(assigned_to_staff_id);
CREATE INDEX IF NOT EXISTS idx_sr_assignment_status ON public.service_requests(assignment_status);

-- 4. New events table
CREATE TABLE IF NOT EXISTS public.request_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('assigned','accepted','transferred','unassigned')),
  from_staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  department text,
  note text,
  visible_to_customer boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.request_assignment_events TO authenticated;
GRANT ALL ON public.request_assignment_events TO service_role;

ALTER TABLE public.request_assignment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read assignment events"
  ON public.request_assignment_events FOR SELECT
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      private.has_role(auth.uid(), 'staff'::public.app_role)
      AND EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.assigned_to_staff_id = auth.uid())
    )
    OR (
      visible_to_customer = true
      AND EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.user_id = auth.uid())
    )
  );

CREATE POLICY "Admin insert assignment events"
  ON public.request_assignment_events FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_rae_request ON public.request_assignment_events(request_id, created_at DESC);

-- 5. Tighten staff read on service_requests:
-- staff can read ONLY rows assigned to them or unassigned rows (so they can claim). Admin/customer unchanged.
DROP POLICY IF EXISTS "Read own service requests or staff" ON public.service_requests;
CREATE POLICY "Read service requests by role"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      private.has_role(auth.uid(), 'staff'::public.app_role)
      AND (assigned_to_staff_id = auth.uid() OR assigned_to_staff_id IS NULL)
    )
  );

-- 6. Trigger: log assignment events automatically when fields change
CREATE OR REPLACE FUNCTION public.log_assignment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to_staff_id IS NOT NULL THEN
      INSERT INTO public.request_assignment_events(request_id, event_type, to_staff_id, actor_id, department, note, visible_to_customer)
      VALUES (NEW.id, 'assigned', NEW.assigned_to_staff_id, NEW.assigned_by, NEW.assignment_department, NEW.assignment_note, true);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.assignment_status IS DISTINCT FROM OLD.assignment_status
     OR NEW.assigned_to_staff_id IS DISTINCT FROM OLD.assigned_to_staff_id THEN

    IF NEW.assigned_to_staff_id IS NULL AND OLD.assigned_to_staff_id IS NOT NULL THEN
      v_event := 'unassigned';
    ELSIF OLD.assigned_to_staff_id IS NOT NULL
          AND NEW.assigned_to_staff_id IS NOT NULL
          AND NEW.assigned_to_staff_id <> OLD.assigned_to_staff_id THEN
      v_event := 'transferred';
    ELSIF NEW.assignment_status = 'accepted' AND OLD.assignment_status <> 'accepted' THEN
      v_event := 'accepted';
    ELSIF NEW.assigned_to_staff_id IS NOT NULL AND OLD.assigned_to_staff_id IS NULL THEN
      v_event := 'assigned';
    ELSE
      v_event := NULL;
    END IF;

    IF v_event IS NOT NULL THEN
      INSERT INTO public.request_assignment_events(request_id, event_type, from_staff_id, to_staff_id, actor_id, department, note, visible_to_customer)
      VALUES (NEW.id, v_event, OLD.assigned_to_staff_id, NEW.assigned_to_staff_id, NEW.assigned_by, NEW.assignment_department, NEW.assignment_note,
              v_event <> 'unassigned');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_assignment_event ON public.service_requests;
CREATE TRIGGER trg_log_assignment_event
AFTER INSERT OR UPDATE OF assigned_to_staff_id, assignment_status ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.log_assignment_event();

-- 7. Notifications on assignment changes (customer + staff)
CREATE OR REPLACE FUNCTION public.notify_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display text;
BEGIN
  IF NEW.assignment_status IS NOT DISTINCT FROM OLD.assignment_status
     AND NEW.assigned_to_staff_id IS NOT DISTINCT FROM OLD.assigned_to_staff_id THEN
    RETURN NEW;
  END IF;

  -- Notify staff when newly assigned
  IF NEW.assigned_to_staff_id IS NOT NULL
     AND NEW.assigned_to_staff_id IS DISTINCT FROM OLD.assigned_to_staff_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, related_url)
    VALUES (
      NEW.assigned_to_staff_id,
      'تم إسناد طلب لك',
      'تم إسناد طلب جديد إليك للمتابعة',
      'assignment',
      '/admin/requests/' || NEW.id::text
    );
  END IF;

  -- Notify customer
  IF NEW.user_id IS NOT NULL THEN
    IF NEW.assignment_status = 'assigned' AND OLD.assignment_status <> 'assigned' THEN
      INSERT INTO public.notifications (user_id, title, body, type, related_url)
      VALUES (NEW.user_id, 'تم تعيين مسؤول لمتابعة طلبك',
              'سيتم تحديثك قريبًا بآخر المستجدات.',
              'assignment', '/account/requests/' || NEW.id::text);
    ELSIF NEW.assignment_status = 'accepted' AND OLD.assignment_status <> 'accepted' THEN
      SELECT display_name_for_customer INTO v_display FROM public.profiles WHERE id = NEW.assigned_to_staff_id;
      INSERT INTO public.notifications (user_id, title, body, type, related_url)
      VALUES (NEW.user_id, 'تم استلام طلبك من فريق Aqua Haven',
              COALESCE(v_display, 'فريق Aqua Haven') || ' يتابع طلبك الآن.',
              'assignment', '/account/requests/' || NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_assignment ON public.service_requests;
CREATE TRIGGER trg_notify_on_assignment
AFTER UPDATE OF assigned_to_staff_id, assignment_status ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_assignment();

REVOKE ALL ON FUNCTION public.log_assignment_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_assignment() FROM PUBLIC, anon, authenticated;
