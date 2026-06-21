
-- 1) Revert anonymous service_requests insert
DROP POLICY IF EXISTS "Visitors submit service requests" ON public.service_requests;
REVOKE INSERT ON public.service_requests FROM anon;

-- 2) Notifications: column-restricted update for owners (non-staff/admin)
CREATE OR REPLACE FUNCTION public.notifications_owner_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::public.app_role)
     OR private.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RETURN NEW;
  END IF;
  -- Owners can only flip is_read
  NEW.user_id := OLD.user_id;
  NEW.title := OLD.title;
  NEW.body := OLD.body;
  NEW.type := OLD.type;
  NEW.related_url := OLD.related_url;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_notifications_owner_update_guard ON public.notifications;
CREATE TRIGGER trg_notifications_owner_update_guard
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_owner_update_guard();

REVOKE EXECUTE ON FUNCTION public.notifications_owner_update_guard() FROM PUBLIC, anon, authenticated;

-- 3) finance_suppliers: restrict read to admin/finance_manage only
DROP POLICY IF EXISTS "fin_sup_read" ON public.finance_suppliers;
CREATE POLICY "fin_sup_read" ON public.finance_suppliers
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(),'admin'::public.app_role)
  OR private.has_role(auth.uid(),'finance_manage'::public.app_role)
);

-- 4) Lock down SECURITY DEFINER functions in public schema.
-- Trigger functions: revoke EXECUTE from anon/authenticated/public (triggers still fire).
REVOKE EXECUTE ON FUNCTION public.appointments_guard_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_accountant_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_refresh_attachment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_write_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_assignment_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_appointment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_public_note() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_status_change() FROM PUBLIC, anon, authenticated;

-- RPC functions used by app: revoke from anon/public, keep authenticated (functions enforce role internally)
REVOKE EXECUTE ON FUNCTION public.finance_archive_import_batch(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finance_restore_import_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_archive_import_batch(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_restore_import_batch(uuid) TO authenticated;
