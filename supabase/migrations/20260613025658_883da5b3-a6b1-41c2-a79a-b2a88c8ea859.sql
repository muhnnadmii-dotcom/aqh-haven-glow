DROP POLICY IF EXISTS "Submit contact request" ON public.contact_requests;
CREATE POLICY "Visitors submit contact requests"
ON public.contact_requests
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);
CREATE POLICY "Users submit contact requests"
ON public.contact_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Submit consultation request" ON public.consultation_requests;
CREATE POLICY "Visitors submit consultation requests"
ON public.consultation_requests
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);
CREATE POLICY "Users submit consultation requests"
ON public.consultation_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());