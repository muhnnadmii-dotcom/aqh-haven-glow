
-- Drop duplicate has_role in public; keep private.has_role as single source of truth
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Split appointments update policy into customer-restricted and staff-full
DROP POLICY IF EXISTS "Update appts" ON public.appointments;

CREATE POLICY "Customer update own pending appts"
ON public.appointments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'new')
WITH CHECK (auth.uid() = user_id AND status = 'new');

CREATE POLICY "Staff update appts"
ON public.appointments
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));
