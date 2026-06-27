-- Harden SECURITY DEFINER functions (Supabase lint 0028/0029).
ALTER FUNCTION public.aqh_next_quote_no() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.aqh_next_quote_no() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aqh_next_quote_no() TO authenticated;

ALTER FUNCTION public.aqh_bulk_update_products(bigint[], bigint, text, boolean, numeric, uuid) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.aqh_bulk_update_products(bigint[], bigint, text, boolean, numeric, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aqh_bulk_update_products(bigint[], bigint, text, boolean, numeric, uuid) TO authenticated;

CREATE SCHEMA IF NOT EXISTS private;
ALTER FUNCTION public.profiles_guard_privileged_fields() SET SCHEMA private;
REVOKE EXECUTE ON FUNCTION private.profiles_guard_privileged_fields() FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.aqh_home_stats_cache (
  singleton boolean PRIMARY KEY DEFAULT true,
  customers int NOT NULL DEFAULT 0,
  tanks     int NOT NULL DEFAULT 0,
  projects  int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (singleton = true)
);
GRANT SELECT ON public.aqh_home_stats_cache TO anon, authenticated;
GRANT ALL    ON public.aqh_home_stats_cache TO service_role;
ALTER TABLE public.aqh_home_stats_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aqh_home_stats_public_read" ON public.aqh_home_stats_cache;
CREATE POLICY "aqh_home_stats_public_read"
  ON public.aqh_home_stats_cache FOR SELECT USING (true);

INSERT INTO public.aqh_home_stats_cache (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

UPDATE public.aqh_home_stats_cache SET
  customers = (SELECT COUNT(DISTINCT user_id)::int FROM public.customer_tanks WHERE user_id IS NOT NULL),
  tanks     = (SELECT COUNT(*)::int FROM public.customer_tanks),
  projects  = (SELECT COUNT(*)::int FROM public.projects WHERE published = true),
  updated_at = now()
WHERE singleton = true;

CREATE OR REPLACE FUNCTION public.get_home_hero_stats()
RETURNS TABLE(customers integer, tanks integer, projects integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT customers, tanks, projects FROM public.aqh_home_stats_cache WHERE singleton = true LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_home_hero_stats() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_home_hero_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.refresh_aqh_home_stats()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.aqh_home_stats_cache SET
    customers = (SELECT COUNT(DISTINCT user_id)::int FROM public.customer_tanks WHERE user_id IS NOT NULL),
    tanks     = (SELECT COUNT(*)::int FROM public.customer_tanks),
    projects  = (SELECT COUNT(*)::int FROM public.projects WHERE published = true),
    updated_at = now()
  WHERE singleton = true;
$$;
REVOKE EXECUTE ON FUNCTION private.refresh_aqh_home_stats() FROM PUBLIC;

-- Storage RLS for the new private customer-uploads bucket.
DROP POLICY IF EXISTS "customer_uploads_owner_insert" ON storage.objects;
CREATE POLICY "customer_uploads_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'customer-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "customer_uploads_read" ON storage.objects;
CREATE POLICY "customer_uploads_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'customer-uploads'
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'staff'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "customer_uploads_owner_update" ON storage.objects;
CREATE POLICY "customer_uploads_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'customer-uploads'
    AND (owner = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "customer_uploads_owner_delete" ON storage.objects;
CREATE POLICY "customer_uploads_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'customer-uploads'
    AND (owner = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
  );

ALTER TABLE public.request_attachments
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'customer-uploads';

UPDATE public.request_attachments
SET bucket = 'media'
WHERE created_at < now() AND bucket = 'customer-uploads';