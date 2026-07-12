
CREATE OR REPLACE FUNCTION public.finance_log_manual_audit(
  p_related_type text,
  p_related_id uuid,
  p_action text,
  p_field_name text DEFAULT NULL,
  p_old_value text DEFAULT NULL,
  p_new_value text DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_any_finance_role(v_uid) THEN
    RAISE EXCEPTION 'insufficient privileges' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.finance_audit_logs(
    related_type, related_id, action, field_name, old_value, new_value, changed_by, note
  ) VALUES (
    p_related_type, p_related_id, p_action, p_field_name, p_old_value, p_new_value, v_uid, p_note
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_log_manual_audit(text, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_log_manual_audit(text, uuid, text, text, text, text, text) TO authenticated;
