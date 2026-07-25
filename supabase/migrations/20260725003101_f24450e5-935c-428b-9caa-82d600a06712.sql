-- Targeted security hardening for the requested findings only.

-- 1) Public home stats: keep the intentionally public aggregate stats,
-- but restrict the table policy to the single cache row only.
DROP POLICY IF EXISTS "aqh_home_stats_public_read" ON public.aqh_home_stats_cache;
CREATE POLICY "aqh_home_stats_public_read_singleton"
  ON public.aqh_home_stats_cache
  FOR SELECT
  TO anon, authenticated
  USING (singleton IS TRUE);

-- 2) Aquarium care logs: replace broad ALL policy with explicit owner-scoped CRUD policies,
-- including an explicit delete-own policy for customers.
DROP POLICY IF EXISTS "Customers manage own tank logs" ON public.aquarium_care_logs;

CREATE POLICY "Customers read own tank logs"
  ON public.aquarium_care_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.customer_tanks t
      WHERE t.id = aquarium_care_logs.tank_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers insert own tank logs"
  ON public.aquarium_care_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.customer_tanks t
      WHERE t.id = aquarium_care_logs.tank_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers update own tank logs"
  ON public.aquarium_care_logs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.customer_tanks t
      WHERE t.id = aquarium_care_logs.tank_id
        AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.customer_tanks t
      WHERE t.id = aquarium_care_logs.tank_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers delete own tank logs"
  ON public.aquarium_care_logs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.customer_tanks t
      WHERE t.id = aquarium_care_logs.tank_id
        AND t.user_id = auth.uid()
    )
  );

-- 3) Customer notes: recreate explicit staff/admin insert policy.
DROP POLICY IF EXISTS "Staff write customer notes" ON public.customer_notes;
CREATE POLICY "Staff insert customer notes"
  ON public.customer_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'staff'::public.app_role)
  );

-- 4) Customer uploads: require both storage owner and path ownership, and for customer
-- tank/request paths also require a matching application row owned by the caller.
DROP POLICY IF EXISTS "customer_uploads_owner_insert" ON storage.objects;
CREATE POLICY "customer_uploads_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customer-uploads'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'staff'::public.app_role)
      OR (storage.foldername(name))[2] = 'uploads'
      OR (
        (storage.foldername(name))[2] LIKE 'tank-%'
        AND EXISTS (
          SELECT 1 FROM public.customer_tanks t
          WHERE t.id::text = regexp_replace((storage.foldername(name))[2], '^tank-', '')
            AND t.user_id = auth.uid()
        )
      )
      OR (
        (storage.foldername(name))[2] = 'request-attachments'
        AND EXISTS (
          SELECT 1 FROM public.service_requests sr
          WHERE sr.id::text = (storage.foldername(name))[3]
            AND sr.user_id = auth.uid()
        )
      )
    )
  );

-- Prevent customer/user-specific files from being newly uploaded to the public media bucket.
DROP POLICY IF EXISTS "Staff or own-folder upload media" ON storage.objects;
CREATE POLICY "Staff upload public media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (
      private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'staff'::public.app_role)
    )
  );

-- 5) Project categories: split public published reads from staff/admin draft visibility.
DROP POLICY IF EXISTS "Public read published categories" ON public.project_categories;

CREATE POLICY "Public read published categories"
  ON public.project_categories
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Staff read all project categories"
  ON public.project_categories
  FOR SELECT
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'staff'::public.app_role)
  );

-- 6) UI translations: public visitors only need runtime UI copy and auto-translation cache.
-- Admin/staff management remains covered by the existing authenticated management policy.
DROP POLICY IF EXISTS "Anyone can read ui translations" ON public.ui_translations;
CREATE POLICY "Public read runtime ui translations"
  ON public.ui_translations
  FOR SELECT
  TO anon, authenticated
  USING (context IS NULL OR context = 'auto');

-- 7) SECURITY DEFINER trigger functions should never be directly executable by users.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef
      AND p.prorettype = 'trigger'::regtype
      AND n.nspname IN ('public', 'private')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;