
REVOKE EXECUTE ON FUNCTION private.has_any_finance_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_set_month() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_accountant_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_refresh_attachment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_write_audit() FROM PUBLIC, anon, authenticated;
