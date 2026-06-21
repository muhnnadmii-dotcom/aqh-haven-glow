
CREATE OR REPLACE FUNCTION public.finance_get_actor_names(ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT p.id, COALESCE(NULLIF(p.full_name, ''), NULLIF(p.display_name_for_customer, ''), 'مستخدم')
  FROM public.profiles p
  WHERE p.id = ANY(ids)
    AND (private.has_role(auth.uid(),'admin') OR private.has_any_finance_role(auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.finance_get_actor_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_get_actor_names(uuid[]) TO authenticated;
