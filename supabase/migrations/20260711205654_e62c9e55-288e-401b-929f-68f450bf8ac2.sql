
-- Helper: does the current session satisfy MFA when the user has enrolled a factor?
-- If the user has any verified MFA factor, the session must be at aal2.
-- Users without any verified factor pass (so first-time enrollment isn't blocked).
CREATE OR REPLACE FUNCTION private.session_meets_mfa(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM auth.mfa_factors
        WHERE user_id = _user_id AND status = 'verified'
      )
      THEN COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'aal', '') = 'aal2'
      ELSE true
    END
$$;

REVOKE EXECUTE ON FUNCTION private.session_meets_mfa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.session_meets_mfa(uuid) TO authenticated, service_role;

-- Wrap private.has_role: require MFA when caller has enrolled a factor
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
  AND private.session_meets_mfa(_user_id)
$$;

-- Wrap private.has_any_finance_role: same MFA gate
CREATE OR REPLACE FUNCTION private.has_any_finance_role(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','finance_view','finance_manage','finance_accountant','finance_export','finance_settings')
  )
  AND private.session_meets_mfa(_uid)
$$;
