DROP POLICY "Insert own appts" ON public.appointments;
CREATE POLICY "Insert own appts" ON public.appointments
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (tank_id IS NULL OR EXISTS (
    SELECT 1 FROM public.customer_tanks ct WHERE ct.id = tank_id AND ct.user_id = auth.uid()
  ))
);

DROP POLICY "Insert own service request" ON public.service_requests;
CREATE POLICY "Insert own service request" ON public.service_requests
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (tank_id IS NULL OR EXISTS (
    SELECT 1 FROM public.customer_tanks ct WHERE ct.id = tank_id AND ct.user_id = auth.uid()
  ))
);