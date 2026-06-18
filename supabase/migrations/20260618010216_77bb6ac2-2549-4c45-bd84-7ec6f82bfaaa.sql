
-- Notifications table for customer activity feed
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'general',
  related_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only mark their notifications as read; cannot reassign or change content
CREATE POLICY "Users update own notifications read flag"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff manage notifications"
  ON public.notifications FOR ALL
  USING (private.has_role(auth.uid(), 'staff'::public.app_role)
      OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'staff'::public.app_role)
      OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- Triggers to auto-create notifications
-- ============================================================

-- Notify customer when a public note is added by someone other than themselves
CREATE OR REPLACE FUNCTION public.notify_on_public_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.visibility <> 'public' THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user_id FROM public.service_requests WHERE id = NEW.request_id;
  IF v_user_id IS NULL OR v_user_id = NEW.author_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body, type, related_url)
  VALUES (
    v_user_id,
    'تعليق جديد من Aqua Haven',
    LEFT(NEW.body, 140),
    'comment',
    '/account/requests/' || NEW.request_id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_public_note
  AFTER INSERT ON public.request_notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_public_note();

-- Notify customer when a visible report is created
CREATE OR REPLACE FUNCTION public.notify_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT NEW.is_visible_to_customer THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user_id FROM public.service_requests WHERE id = NEW.request_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body, type, related_url)
  VALUES (
    v_user_id,
    'تقرير جديد: ' || NEW.title,
    NULL,
    'report',
    '/account/requests/' || NEW.request_id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_report
  AFTER INSERT ON public.request_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_report();

-- Notify customer when their request status changes
CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body, type, related_url)
  VALUES (
    NEW.user_id,
    'تم تحديث حالة طلبك',
    'الحالة الجديدة: ' || NEW.status,
    'status',
    '/account/requests/' || NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE OF status ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_status_change();

-- Notify customer when an appointment is created for them
CREATE OR REPLACE FUNCTION public.notify_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body, type, related_url)
  VALUES (
    NEW.user_id,
    'تم تحديد موعد جديد',
    COALESCE(NEW.kind, '') || CASE WHEN NEW.preferred_date IS NOT NULL THEN ' · ' || to_char(NEW.preferred_date, 'YYYY-MM-DD HH24:MI') ELSE '' END,
    'appointment',
    CASE WHEN NEW.service_request_id IS NOT NULL
         THEN '/account/requests/' || NEW.service_request_id::text
         ELSE '/account/appointments' END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_appointment();
