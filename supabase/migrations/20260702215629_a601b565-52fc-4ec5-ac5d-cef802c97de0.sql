-- Revoke EXECUTE from PUBLIC/authenticated/anon on SECURITY DEFINER functions
-- that are internal triggers/guards and must not be callable directly by end users.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.appointments_guard_sensitive_fields()',
    'public.finance_accountant_guard()',
    'public.finance_refresh_attachment_status()',
    'public.finance_set_month()',
    'public.finance_write_audit()',
    'public.handle_new_user()',
    'public.log_assignment_event()',
    'public.notifications_owner_update_guard()',
    'public.notify_on_appointment()',
    'public.notify_on_assignment()',
    'public.notify_on_public_note()',
    'public.notify_on_report()',
    'public.notify_on_status_change()',
    'public.site_nav_links_touch_updated_at()',
    'public.touch_updated_at()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;