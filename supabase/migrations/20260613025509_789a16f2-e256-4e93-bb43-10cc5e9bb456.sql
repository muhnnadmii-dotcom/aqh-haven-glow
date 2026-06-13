CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DO $$
DECLARE
  p record;
  qual_sql text;
  check_sql text;
  cmd_sql text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE (schemaname IN ('public', 'storage'))
      AND (qual ILIKE '%has_role%' OR with_check ILIKE '%has_role%')
  LOOP
    qual_sql := CASE WHEN p.qual IS NULL THEN NULL ELSE replace(p.qual, 'has_role(', 'private.has_role(') END;
    check_sql := CASE WHEN p.with_check IS NULL THEN NULL ELSE replace(p.with_check, 'has_role(', 'private.has_role(') END;

    cmd_sql := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF qual_sql IS NOT NULL THEN
      cmd_sql := cmd_sql || format(' USING (%s)', qual_sql);
    END IF;
    IF check_sql IS NOT NULL THEN
      cmd_sql := cmd_sql || format(' WITH CHECK (%s)', check_sql);
    END IF;
    EXECUTE cmd_sql;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;