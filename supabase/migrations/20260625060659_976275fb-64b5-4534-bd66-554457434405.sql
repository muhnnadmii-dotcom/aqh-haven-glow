
CREATE OR REPLACE FUNCTION public.get_home_hero_stats()
RETURNS TABLE(customers integer, tanks integer, projects integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(DISTINCT user_id)::int FROM public.customer_tanks WHERE user_id IS NOT NULL),
    (SELECT COUNT(*)::int FROM public.customer_tanks),
    (SELECT COUNT(*)::int FROM public.projects WHERE published = true);
$$;

GRANT EXECUTE ON FUNCTION public.get_home_hero_stats() TO anon, authenticated;
