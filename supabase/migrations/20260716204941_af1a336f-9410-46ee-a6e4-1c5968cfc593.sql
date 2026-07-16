
-- 1) wallet_account_id on payment_providers
ALTER TABLE public.payment_providers
  ADD COLUMN IF NOT EXISTS wallet_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT;

UPDATE public.payment_providers
  SET wallet_account_id = 'a1b68f47-84e4-45d0-8938-01bed152984d'
  WHERE id = '2969b351-105d-4998-b33b-e01ca4e1d541'
    AND wallet_account_id IS NULL;

-- 2) purchase_invoice_provider_payments
CREATE TABLE IF NOT EXISTS public.purchase_invoice_provider_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id bigint NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.payment_providers(id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  source_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','reversed')),
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  reversed_by uuid REFERENCES auth.users(id),
  reversed_at timestamptz,
  reversed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipp_invoice ON public.purchase_invoice_provider_payments(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_pipp_provider ON public.purchase_invoice_provider_payments(provider_id);
CREATE INDEX IF NOT EXISTS idx_pipp_status ON public.purchase_invoice_provider_payments(status);
CREATE INDEX IF NOT EXISTS idx_pipp_journal ON public.purchase_invoice_provider_payments(journal_entry_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoice_provider_payments TO authenticated;
GRANT ALL ON public.purchase_invoice_provider_payments TO service_role;

ALTER TABLE public.purchase_invoice_provider_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipp_read ON public.purchase_invoice_provider_payments;
CREATE POLICY pipp_read ON public.purchase_invoice_provider_payments FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));

DROP POLICY IF EXISTS pipp_insert ON public.purchase_invoice_provider_payments;
CREATE POLICY pipp_insert ON public.purchase_invoice_provider_payments FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'finance_manage'::app_role)
    OR private.has_role(auth.uid(),'finance_accountant'::app_role)
  );

DROP POLICY IF EXISTS pipp_update ON public.purchase_invoice_provider_payments;
CREATE POLICY pipp_update ON public.purchase_invoice_provider_payments FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'finance_manage'::app_role)
    OR private.has_role(auth.uid(),'finance_accountant'::app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'finance_manage'::app_role)
    OR private.has_role(auth.uid(),'finance_accountant'::app_role)
  );

DROP POLICY IF EXISTS pipp_delete ON public.purchase_invoice_provider_payments;
CREATE POLICY pipp_delete ON public.purchase_invoice_provider_payments FOR DELETE TO authenticated
  USING (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'finance_manage'::app_role)
  );

DROP TRIGGER IF EXISTS trg_pipp_updated_at ON public.purchase_invoice_provider_payments;
CREATE TRIGGER trg_pipp_updated_at BEFORE UPDATE ON public.purchase_invoice_provider_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Recalc: include confirmed provider payments in paid_amount
CREATE OR REPLACE FUNCTION public.purchase_invoice_recalc_totals(p_invoice_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sub numeric(14,2) := 0;
  v_disc numeric(14,2) := 0;
  v_taxable numeric(14,2) := 0;
  v_vat numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_paid_exp numeric(14,2) := 0;
  v_paid_prov numeric(14,2) := 0;
  v_paid numeric(14,2) := 0;
  v_ded_pct numeric(6,3);
  v_ded numeric(14,2);
  v_nondec numeric(14,2);
  v_vat_ded public.purchase_vat_deductibility;
  v_current public.purchase_invoice_status;
BEGIN
  SELECT
    COALESCE(SUM(ROUND(quantity*unit_price,2)),0),
    COALESCE(SUM(discount_amount),0),
    COALESCE(SUM(line_subtotal),0),
    COALESCE(SUM(line_tax_amount),0),
    COALESCE(SUM(line_total),0)
  INTO v_sub, v_disc, v_taxable, v_vat, v_total
  FROM public.purchase_invoice_items WHERE purchase_invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount),0) INTO v_paid_exp
  FROM public.finance_expenses
  WHERE purchase_invoice_id = p_invoice_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(amount),0) INTO v_paid_prov
  FROM public.purchase_invoice_provider_payments
  WHERE purchase_invoice_id = p_invoice_id AND status = 'confirmed';

  v_paid := v_paid_exp + v_paid_prov;

  SELECT vat_deductibility, deductible_percentage, status
    INTO v_vat_ded, v_ded_pct, v_current
    FROM public.purchase_invoices WHERE id = p_invoice_id;

  IF v_vat_ded = 'fully_deductible' THEN
    v_ded := v_vat; v_nondec := 0;
  ELSIF v_vat_ded = 'non_deductible' THEN
    v_ded := 0; v_nondec := v_vat;
  ELSIF v_vat_ded = 'partially_deductible' THEN
    v_ded := ROUND(v_vat * COALESCE(v_ded_pct,0) / 100.0, 2);
    v_nondec := v_vat - v_ded;
  ELSE
    v_ded := 0; v_nondec := 0;
  END IF;

  UPDATE public.purchase_invoices SET
    subtotal = v_sub,
    discount_amount = v_disc,
    taxable_amount = v_taxable,
    vat_amount = v_vat,
    deductible_vat_amount = v_ded,
    non_deductible_vat_amount = v_nondec,
    total_amount = v_total,
    paid_amount = v_paid,
    remaining_amount = GREATEST(v_total - v_paid, 0),
    payment_status = CASE
      WHEN v_paid <= 0 THEN 'unpaid'::public.purchase_payment_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.purchase_payment_status
      WHEN v_paid = v_total THEN 'paid'::public.purchase_payment_status
      ELSE 'overpaid'::public.purchase_payment_status
    END,
    status = CASE
      WHEN v_current IN ('draft','under_review','rejected') THEN v_current
      WHEN v_paid <= 0 THEN 'approved'::public.purchase_invoice_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.purchase_invoice_status
      WHEN v_paid >= v_total THEN 'paid'::public.purchase_invoice_status
      ELSE v_current
    END
  WHERE id = p_invoice_id;
END $function$;

-- 4) Preview RPC (read-only)
CREATE OR REPLACE FUNCTION public.preview_provider_invoice_payment(
  p_invoice_id bigint,
  p_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv public.purchase_invoices;
  v_prov public.payment_providers;
  v_wallet public.chart_of_accounts;
  v_clearing public.chart_of_accounts;
  v_src public.chart_of_accounts;
  v_amount numeric(14,2);
  v_ap_id uuid;
  v_ap public.chart_of_accounts;
  v_warn text[] := '{}';
BEGIN
  IF NOT (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_any_finance_role(auth.uid())
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_inv FROM public.purchase_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_inv.payment_provider_id IS NULL THEN RAISE EXCEPTION 'invoice_has_no_provider'; END IF;
  IF v_inv.status IN ('draft','rejected') THEN RAISE EXCEPTION 'invoice_not_payable_in_status_%', v_inv.status; END IF;

  SELECT * INTO v_prov FROM public.payment_providers WHERE id = v_inv.payment_provider_id;

  IF v_prov.wallet_account_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.chart_of_accounts WHERE id = v_prov.wallet_account_id;
    v_src := v_wallet;
  ELSIF v_prov.clearing_account_id IS NOT NULL THEN
    SELECT * INTO v_clearing FROM public.chart_of_accounts WHERE id = v_prov.clearing_account_id;
    v_src := v_clearing;
    v_warn := array_append(v_warn, 'no_wallet_account_using_clearing');
  ELSE
    RAISE EXCEPTION 'provider_has_no_wallet_or_clearing_account';
  END IF;

  v_amount := COALESCE(p_amount, v_inv.remaining_amount);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'nothing_to_pay'; END IF;
  IF v_amount > v_inv.remaining_amount + COALESCE(v_prov.rounding_tolerance,0) THEN
    RAISE EXCEPTION 'amount_exceeds_remaining';
  END IF;

  SELECT id INTO v_ap_id FROM public.chart_of_accounts WHERE code = '2100' LIMIT 1;
  IF v_ap_id IS NULL THEN RAISE EXCEPTION 'ap_account_not_found_code_2100'; END IF;
  SELECT * INTO v_ap FROM public.chart_of_accounts WHERE id = v_ap_id;

  RETURN jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', v_inv.id,
      'internal_reference', v_inv.internal_reference,
      'status', v_inv.status,
      'total_amount', v_inv.total_amount,
      'paid_amount', v_inv.paid_amount,
      'remaining_amount', v_inv.remaining_amount
    ),
    'provider', jsonb_build_object(
      'id', v_prov.id, 'name', v_prov.name,
      'wallet_account_id', v_prov.wallet_account_id,
      'clearing_account_id', v_prov.clearing_account_id,
      'rounding_tolerance', v_prov.rounding_tolerance
    ),
    'source_account', jsonb_build_object(
      'id', v_src.id, 'code', v_src.code, 'name_ar', v_src.name_ar,
      'is_wallet', (v_prov.wallet_account_id IS NOT NULL AND v_src.id = v_prov.wallet_account_id)
    ),
    'amount', v_amount,
    'cash_effect', 0,
    'preview_entry', jsonb_build_array(
      jsonb_build_object('type','debit','account_id',v_ap.id,'account_code',v_ap.code,'account_name',v_ap.name_ar,'amount',v_amount,'description','سداد فاتورة مشتريات من رصيد بوابة الدفع'),
      jsonb_build_object('type','credit','account_id',v_src.id,'account_code',v_src.code,'account_name',v_src.name_ar,'amount',v_amount,'description','تخفيض رصيد '||v_src.name_ar)
    ),
    'warnings', to_jsonb(v_warn)
  );
END $$;

REVOKE ALL ON FUNCTION public.preview_provider_invoice_payment(bigint, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_provider_invoice_payment(bigint, numeric) TO authenticated;

-- 5) Confirm RPC
CREATE OR REPLACE FUNCTION public.confirm_provider_invoice_payment(
  p_invoice_id bigint,
  p_amount numeric,
  p_payment_date date DEFAULT NULL,
  p_source_account_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv public.purchase_invoices;
  v_prov public.payment_providers;
  v_src_id uuid;
  v_src public.chart_of_accounts;
  v_ap_id uuid;
  v_ap public.chart_of_accounts;
  v_pay_id uuid;
  v_entry_id uuid;
  v_entry_num text;
  v_date date;
  v_tol numeric(14,2);
BEGIN
  IF NOT (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'finance_manage'::app_role)
    OR private.has_role(auth.uid(),'finance_accountant'::app_role)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_inv FROM public.purchase_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_inv.payment_provider_id IS NULL THEN RAISE EXCEPTION 'invoice_has_no_provider'; END IF;
  IF v_inv.status IN ('draft','rejected') THEN RAISE EXCEPTION 'invoice_not_payable_in_status_%', v_inv.status; END IF;

  SELECT * INTO v_prov FROM public.payment_providers WHERE id = v_inv.payment_provider_id;
  v_tol := COALESCE(v_prov.rounding_tolerance, 0);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  IF p_amount > v_inv.remaining_amount + v_tol THEN RAISE EXCEPTION 'amount_exceeds_remaining'; END IF;

  v_src_id := COALESCE(p_source_account_id, v_prov.wallet_account_id, v_prov.clearing_account_id);
  IF v_src_id IS NULL THEN RAISE EXCEPTION 'no_source_account_available'; END IF;

  IF v_src_id <> COALESCE(v_prov.wallet_account_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND v_src_id <> COALESCE(v_prov.clearing_account_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'source_account_not_allowed_for_provider';
  END IF;

  SELECT * INTO v_src FROM public.chart_of_accounts WHERE id = v_src_id;

  -- Prevent duplicate confirmed payment covering full remaining
  IF EXISTS (
    SELECT 1 FROM public.purchase_invoice_provider_payments
    WHERE purchase_invoice_id = p_invoice_id AND status = 'confirmed'
      AND amount >= v_inv.remaining_amount - v_tol
  ) THEN
    RAISE EXCEPTION 'invoice_already_fully_paid_by_provider_wallet';
  END IF;

  SELECT id INTO v_ap_id FROM public.chart_of_accounts WHERE code = '2100' LIMIT 1;
  IF v_ap_id IS NULL THEN RAISE EXCEPTION 'ap_account_not_found_code_2100'; END IF;
  SELECT * INTO v_ap FROM public.chart_of_accounts WHERE id = v_ap_id;

  v_date := COALESCE(p_payment_date, CURRENT_DATE);
  v_entry_num := 'JE-PIPP-' || to_char(now(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,4);

  INSERT INTO public.journal_entries(entry_number, entry_date, source_type, source_id, description, status, total_debit, total_credit, created_by)
  VALUES (v_entry_num, v_date, 'purchase_invoice_payment'::journal_source_type,
          'pipp:'||gen_random_uuid()::text,
          'دفع فاتورة مشتريات '||v_inv.internal_reference||' من رصيد بوابة '||v_prov.name,
          'draft'::journal_entry_status, p_amount, p_amount, auth.uid())
  RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, line_order)
  VALUES
    (v_entry_id, v_ap.id, 'الموردون (تخفيض)', p_amount, 0, v_inv.supplier_id, 0),
    (v_entry_id, v_src.id, 'تخفيض رصيد '||v_src.name_ar, 0, p_amount, NULL, 1);

  INSERT INTO public.purchase_invoice_provider_payments(
    purchase_invoice_id, provider_id, payment_date, amount, source_account_id,
    status, journal_entry_id, notes, created_by, confirmed_by, confirmed_at
  ) VALUES (
    p_invoice_id, v_inv.payment_provider_id, v_date, p_amount, v_src_id,
    'confirmed', v_entry_id, p_notes, auth.uid(), auth.uid(), now()
  ) RETURNING id INTO v_pay_id;

  -- Point journal entry source_id at the payment record
  UPDATE public.journal_entries SET source_id = 'pipp:'||v_pay_id::text WHERE id = v_entry_id;

  PERFORM public.purchase_invoice_recalc_totals(p_invoice_id);

  -- Audit
  BEGIN
    INSERT INTO public.finance_audit_logs(entity_type, entity_id, action, performed_by, notes, metadata)
    VALUES ('purchase_invoice', p_invoice_id::text, 'provider_wallet_payment_confirmed', auth.uid(),
            'دفع من رصيد بوابة '||v_prov.name,
            jsonb_build_object('payment_id', v_pay_id, 'amount', p_amount, 'source_account_id', v_src_id, 'journal_entry_id', v_entry_id));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  RETURN jsonb_build_object('payment_id', v_pay_id, 'journal_entry_id', v_entry_id, 'amount', p_amount);
END $$;

REVOKE ALL ON FUNCTION public.confirm_provider_invoice_payment(bigint, numeric, date, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_provider_invoice_payment(bigint, numeric, date, uuid, text) TO authenticated;

-- 6) Reverse RPC
CREATE OR REPLACE FUNCTION public.reverse_provider_invoice_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pay public.purchase_invoice_provider_payments;
  v_je public.journal_entries;
  v_new_entry_id uuid;
  v_entry_num text;
BEGIN
  IF NOT (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'finance_manage'::app_role)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO v_pay FROM public.purchase_invoice_provider_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF v_pay.status = 'reversed' THEN RAISE EXCEPTION 'already_reversed'; END IF;

  IF v_pay.journal_entry_id IS NOT NULL THEN
    SELECT * INTO v_je FROM public.journal_entries WHERE id = v_pay.journal_entry_id;
    IF v_je.status = 'draft' THEN
      UPDATE public.journal_entries SET status = 'reversed'::journal_entry_status WHERE id = v_je.id;
    ELSIF v_je.status = 'posted' THEN
      v_entry_num := 'JE-PIPP-REV-' || to_char(now(),'YYYYMMDDHH24MISSMS');
      INSERT INTO public.journal_entries(entry_number, entry_date, source_type, source_id, description, status, total_debit, total_credit, created_by, reversed_by_entry_id)
      VALUES (v_entry_num, CURRENT_DATE, 'purchase_invoice_payment'::journal_source_type,
              'pipp-rev:'||v_pay.id::text, 'عكس دفعة من رصيد بوابة (سبب: '||p_reason||')',
              'draft'::journal_entry_status, v_pay.amount, v_pay.amount, auth.uid(), v_je.id)
      RETURNING id INTO v_new_entry_id;
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
      SELECT v_new_entry_id, account_id, 'عكس: '||COALESCE(description,''), credit, debit, line_order
      FROM public.journal_entry_lines WHERE journal_entry_id = v_je.id;
      UPDATE public.journal_entries SET reversal_entry_id = v_new_entry_id WHERE id = v_je.id;
    END IF;
  END IF;

  UPDATE public.purchase_invoice_provider_payments
    SET status = 'reversed', reversed_by = auth.uid(), reversed_at = now(), reversed_reason = p_reason
    WHERE id = p_payment_id;

  PERFORM public.purchase_invoice_recalc_totals(v_pay.purchase_invoice_id);

  BEGIN
    INSERT INTO public.finance_audit_logs(entity_type, entity_id, action, performed_by, notes, metadata)
    VALUES ('purchase_invoice', v_pay.purchase_invoice_id::text, 'provider_wallet_payment_reversed', auth.uid(),
            p_reason, jsonb_build_object('payment_id', v_pay.id, 'journal_entry_id', v_pay.journal_entry_id, 'reversal_entry_id', v_new_entry_id));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  RETURN jsonb_build_object('payment_id', v_pay.id, 'reversal_entry_id', v_new_entry_id);
END $$;

REVOKE ALL ON FUNCTION public.reverse_provider_invoice_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_provider_invoice_payment(uuid, text) TO authenticated;
