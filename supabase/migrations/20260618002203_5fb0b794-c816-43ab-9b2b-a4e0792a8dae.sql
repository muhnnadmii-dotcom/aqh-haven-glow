
-- 1) consultation_requests: include staff in SELECT
DROP POLICY IF EXISTS "Users read own consultations" ON public.consultation_requests;
CREATE POLICY "Users or staff read consultations"
ON public.consultation_requests
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'staff'::public.app_role)
);

-- 2) service_requests: remove anonymous INSERT
DROP POLICY IF EXISTS "Visitors submit service requests" ON public.service_requests;

-- 3) water_tests: allow customers to insert for their own tanks
CREATE POLICY "Customers insert tests for own tanks"
ON public.water_tests
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_tanks t
    WHERE t.id = water_tests.tank_id AND t.user_id = auth.uid()
  )
);

-- 4) storage.objects: drop broad public SELECT (which enabled listing).
-- Public file URLs under /storage/v1/object/public/media/... continue to work
-- without an RLS SELECT policy because public buckets are served by the CDN.
-- Add a staff/admin SELECT policy so the admin panel can still list files.
DROP POLICY IF EXISTS "Public read media" ON storage.objects;

CREATE POLICY "Staff list media"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'staff'::public.app_role)
    OR owner = auth.uid()
  )
);
