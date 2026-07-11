DROP POLICY IF EXISTS "Customer update own pending appts" ON public.appointments;
CREATE POLICY "Customer update own pending appts" ON public.appointments
FOR UPDATE
USING (auth.uid() = user_id AND status = 'new')
WITH CHECK (auth.uid() = user_id AND status = 'new');