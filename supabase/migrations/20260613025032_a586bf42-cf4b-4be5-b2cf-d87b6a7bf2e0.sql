REVOKE EXECUTE ON FUNCTION public.appointments_guard_sensitive_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.appointments_guard_sensitive_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.appointments_guard_sensitive_fields() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.appointments_guard_sensitive_fields() FROM service_role;