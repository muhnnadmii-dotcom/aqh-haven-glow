CREATE OR REPLACE FUNCTION public.appointments_guard_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::public.app_role)
     OR private.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.admin_notes := OLD.admin_notes;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.appointments_guard_sensitive_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appointments_guard_sensitive_fields() TO service_role;