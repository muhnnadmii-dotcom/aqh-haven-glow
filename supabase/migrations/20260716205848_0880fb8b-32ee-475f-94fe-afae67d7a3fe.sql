-- Follow-up to 20260716204941: lock down provider wallet payment path.
-- No data changes. No accounting behavior changes.

-- 1) Table: revoke direct write privileges from authenticated / anon.
REVOKE INSERT, UPDATE, DELETE ON public.purchase_invoice_provider_payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, SELECT ON public.purchase_invoice_provider_payments FROM anon;
GRANT SELECT ON public.purchase_invoice_provider_payments TO authenticated;
GRANT ALL ON public.purchase_invoice_provider_payments TO service_role;

-- Drop the direct-write RLS policies. Keep pipp_read.
DROP POLICY IF EXISTS pipp_insert ON public.purchase_invoice_provider_payments;
DROP POLICY IF EXISTS pipp_update ON public.purchase_invoice_provider_payments;
DROP POLICY IF EXISTS pipp_delete ON public.purchase_invoice_provider_payments;

-- 2) RPC EXECUTE grants: authenticated only.
REVOKE ALL ON FUNCTION public.preview_provider_invoice_payment(bigint, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_provider_invoice_payment(bigint, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_provider_invoice_payment(bigint, numeric, date, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_provider_invoice_payment(bigint, numeric, date, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_provider_invoice_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_provider_invoice_payment(uuid, text) TO authenticated;

-- 3) Replace confirm/reverse RPCs — same behavior, correct audit schema.
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

  UPDATE public.journal_entries SET source_id = 'pipp:'||v_pay_id::text WHERE id = v_entry_id;

  PERFORM public.purchase_invoice_recalc_totals(p_invoice_id);

  -- Audit — real finance_audit_logs schema.
  INSERT INTO public.finance_audit_logs(
    related_type, related_bigint_id, action, changed_by, note, new_value
  )
  VALUES (
    'purchase_invoice',
    p_invoice_id,
    'provider_wallet_payment_confirmed',
    auth.uid(),
    'دفع من رصيد بوابة '||v_prov.name,
    jsonb_build_object(
      'payment_id', v_pay_id,
      'amount', p_amount,
      'source_account_id', v_src_id,
      'journal_entry_id', v_entry_id,
      'provider_id', v_inv.payment_provider_id,
      'payment_date', v_date
    )::text
  );

  RETURN jsonb_build_object('payment_id', v_pay_id, 'journal_entry_id', v_entry_id, 'amount', p_amount);
END $$;

REVOKE ALL ON FUNCTION public.confirm_provider_invoice_payment(bigint, numeric, date, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_provider_invoice_payment(bigint, numeric, date, uuid, text) TO authenticated;

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

  -- Audit — real finance_audit_logs schema.
  INSERT INTO public.finance_audit_logs(
    related_type, related_bigint_id, action, changed_by, note, new_value
  )
  VALUES (
    'purchase_invoice',
    v_pay.purchase_invoice_id,
    'provider_wallet_payment_reversed',
    auth.uid(),
    p_reason,
    jsonb_build_object(
      'payment_id', v_pay.id,
      'journal_entry_id', v_pay.journal_entry_id,
      'reversal_entry_id', v_new_entry_id,
      'amount', v_pay.amount
    )::text
  );

  RETURN jsonb_build_object('payment_id', v_pay.id, 'reversal_entry_id', v_new_entry_id);
END $$;

REVOKE ALL ON FUNCTION public.reverse_provider_invoice_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_provider_invoice_payment(uuid, text) TO authenticated;
