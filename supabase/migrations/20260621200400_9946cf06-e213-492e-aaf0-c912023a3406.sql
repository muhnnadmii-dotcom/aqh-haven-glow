-- Revoke EXECUTE on SECURITY DEFINER functions that are only called from triggers,
-- so they are not callable directly by signed-in users via PostgREST/RPC.
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
REVOKE EXECUTE ON FUNCTION public.finance_set_month() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;