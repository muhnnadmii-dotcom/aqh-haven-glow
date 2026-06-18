
-- 1) Staff read access to contact_requests
CREATE POLICY "Staff read contact requests" ON public.contact_requests
  FOR SELECT
  USING (private.has_role(auth.uid(), 'staff'::public.app_role));

-- 2) Tighten customer UPDATE on appointments: lock immutable fields via WITH CHECK
DROP POLICY IF EXISTS "Customer update own pending appts" ON public.appointments;
CREATE POLICY "Customer update own pending appts" ON public.appointments
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'new')
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'new'
    AND user_id = (SELECT user_id FROM public.appointments a WHERE a.id = appointments.id)
  );

-- 3) Customers read own visible status history
CREATE POLICY "Customers read own visible status history" ON public.request_status_history
  FOR SELECT
  USING (
    is_visible_to_customer = true
    AND EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = request_status_history.request_id
        AND sr.user_id = auth.uid()
    )
  );
