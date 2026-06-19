
-- 1) Restrict customers to only updating the is_read flag on their notifications
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- 2) Allow customers to update and delete water tests they recorded for their own tanks
CREATE POLICY "Customers update tests for own tanks"
ON public.water_tests
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = water_tests.tank_id AND t.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = water_tests.tank_id AND t.user_id = auth.uid()));

CREATE POLICY "Customers delete tests for own tanks"
ON public.water_tests
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.customer_tanks t WHERE t.id = water_tests.tank_id AND t.user_id = auth.uid()));
