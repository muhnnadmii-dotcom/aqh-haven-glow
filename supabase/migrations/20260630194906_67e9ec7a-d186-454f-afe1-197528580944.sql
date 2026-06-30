
-- 1) View: revoke anon, force security_invoker
REVOKE SELECT ON public.aqh_quote_products FROM anon;
ALTER VIEW public.aqh_quote_products SET (security_invoker = true);

-- 2) SECURITY DEFINER functions: revoke broad EXECUTE; grant only where intentionally callable
REVOKE EXECUTE ON FUNCTION public.appointments_guard_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_accountant_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_refresh_attachment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_write_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_assignment_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notifications_owner_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_appointment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_public_note() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_status_change() FROM PUBLIC, anon, authenticated;

-- RPC-style definers: revoke broad, then grant only to authenticated. Internal has_role checks remain.
REVOKE EXECUTE ON FUNCTION public.finance_archive_import_batch(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finance_restore_import_batch(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finance_get_actor_names(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_custom_allowed_pages() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.i_have_any_custom_role() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.finance_archive_import_batch(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_restore_import_batch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_get_actor_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_custom_allowed_pages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.i_have_any_custom_role() TO authenticated;

-- 3) contact_requests: restrict 'Staff read contact requests' to authenticated role
DROP POLICY IF EXISTS "Staff read contact requests" ON public.contact_requests;
CREATE POLICY "Staff read contact requests"
ON public.contact_requests
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'staff'::public.app_role)
);
