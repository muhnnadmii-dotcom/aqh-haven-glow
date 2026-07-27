
-- 1) home_sections: only expose enabled sections publicly
DROP POLICY IF EXISTS "home_sections public read" ON public.home_sections;
CREATE POLICY "home_sections public read"
  ON public.home_sections
  FOR SELECT
  USING (enabled = true);

-- 2) purchase_invoice_provider_payments: explicit admin/finance write policies
CREATE POLICY "pipp_admin_finance_insert"
  ON public.purchase_invoice_provider_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'finance_manage'::app_role)
  );

CREATE POLICY "pipp_admin_finance_update"
  ON public.purchase_invoice_provider_payments
  FOR UPDATE
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'finance_manage'::app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'finance_manage'::app_role)
  );

CREATE POLICY "pipp_admin_delete"
  ON public.purchase_invoice_provider_payments
  FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
