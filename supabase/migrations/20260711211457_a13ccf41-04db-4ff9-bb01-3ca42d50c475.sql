
-- Re-scope policies from 'public' role to 'authenticated' for defense-in-depth.
-- All existing qual/with_check conditions preserved verbatim.

-- appointments
DROP POLICY IF EXISTS "Customer update own pending appts" ON public.appointments;
CREATE POLICY "Customer update own pending appts" ON public.appointments
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) AND (status = 'new'))
  WITH CHECK ((auth.uid() = user_id) AND (status = 'new') AND (user_id = (SELECT a.user_id FROM public.appointments a WHERE a.id = appointments.id)));

DROP POLICY IF EXISTS "Insert own appts" ON public.appointments;
CREATE POLICY "Insert own appts" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND ((tank_id IS NULL) OR (EXISTS (SELECT 1 FROM public.customer_tanks ct WHERE ct.id = appointments.tank_id AND ct.user_id = auth.uid()))));

-- aqh_quotes
DROP POLICY IF EXISTS "aqh_quotes_all" ON public.aqh_quotes;
CREATE POLICY "aqh_quotes_all" ON public.aqh_quotes
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

-- finance_import_logs
DROP POLICY IF EXISTS "finance_import_logs_update" ON public.finance_import_logs;
CREATE POLICY "finance_import_logs_update" ON public.finance_import_logs
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finance_manage'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finance_manage'::app_role));

-- notifications
DROP POLICY IF EXISTS "Staff manage notifications" ON public.notifications;
CREATE POLICY "Staff manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'staff'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'staff'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications read flag" ON public.notifications;
CREATE POLICY "Users update own notifications read flag" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- service_requests
DROP POLICY IF EXISTS "Insert own service request" ON public.service_requests;
CREATE POLICY "Insert own service request" ON public.service_requests
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND ((tank_id IS NULL) OR (EXISTS (SELECT 1 FROM public.customer_tanks ct WHERE ct.id = service_requests.tank_id AND ct.user_id = auth.uid()))));
