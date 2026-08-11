-- 1) Link provider-wallet payments to a settlement
ALTER TABLE public.purchase_invoice_provider_payments
  ADD COLUMN IF NOT EXISTS settlement_id uuid NULL
    REFERENCES public.payment_settlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipp_settlement
  ON public.purchase_invoice_provider_payments(settlement_id);

-- guard: one active (non-reversed) link per invoice+settlement
CREATE UNIQUE INDEX IF NOT EXISTS uq_pipp_active_invoice_settlement
  ON public.purchase_invoice_provider_payments(purchase_invoice_id, settlement_id)
  WHERE settlement_id IS NOT NULL AND status <> 'reversed';

-- 2) Dedicated settlement field for provider-invoice deductions
ALTER TABLE public.payment_settlements
  ADD COLUMN IF NOT EXISTS provider_invoice_deductions_amount numeric(14,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.compute_settlement_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.expected_net_amount :=
    COALESCE(NEW.gross_sales_amount,0)
    - COALESCE(NEW.refunds_amount,0)
    - COALESCE(NEW.fees_before_vat,0)
    - COALESCE(NEW.fees_vat_amount,0)
    - COALESCE(NEW.payout_fee,0)
    - COALESCE(NEW.other_deductions,0)
    - COALESCE(NEW.provider_invoice_deductions_amount,0)
    + COALESCE(NEW.adjustments_amount,0)
    - COALESCE(NEW.reserve_held,0)
    + COALESCE(NEW.reserve_released,0);
  IF NEW.actual_bank_amount IS NOT NULL THEN
    NEW.difference_amount := NEW.actual_bank_amount - NEW.expected_net_amount;
  ELSE
    NEW.difference_amount := 0;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.recalculate_settlement_totals(_settlement_id uuid)
 RETURNS payment_settlements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gross numeric := 0;
  v_refunds numeric := 0;
  v_adjustments numeric := 0;
  v_reserve_held numeric := 0;
  v_reserve_released numeric := 0;
  v_fees numeric := 0;
  v_fees_vat numeric := 0;
  v_payout_fee numeric := 0;
  v_prov_ded numeric := 0;
  v_expected numeric := 0;
  v_row public.payment_settlements;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'finance_manage') OR
    public.has_role(auth.uid(),'finance_view') OR
    public.has_role(auth.uid(),'finance_accountant')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COALESCE(fees_before_vat,0), COALESCE(fees_vat_amount,0), COALESCE(payout_fee,0),
         COALESCE(provider_invoice_deductions_amount,0)
    INTO v_fees, v_fees_vat, v_payout_fee, v_prov_ded
  FROM public.payment_settlements WHERE id = _settlement_id;

  SELECT
    COALESCE(SUM(CASE WHEN line_type='sale' AND amount>0 THEN amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='refund' THEN ABS(amount) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='adjustment' THEN amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='reserve_held' THEN ABS(amount) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='reserve_released' THEN ABS(amount) ELSE 0 END),0)
  INTO v_gross, v_refunds, v_adjustments, v_reserve_held, v_reserve_released
  FROM public.payment_settlement_lines
  WHERE settlement_id = _settlement_id;

  v_expected := ROUND(v_gross - v_refunds - v_fees - v_fees_vat - v_payout_fee - v_prov_ded
                      + v_adjustments - v_reserve_held + v_reserve_released, 2);

  UPDATE public.payment_settlements
     SET gross_sales_amount = v_gross,
         refunds_amount = v_refunds,
         adjustments_amount = v_adjustments,
         reserve_held = v_reserve_held,
         reserve_released = v_reserve_released,
         expected_net_amount = v_expected,
         updated_at = now()
   WHERE id = _settlement_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- 3) Safe recompute helper (no increment/decrement drift)
CREATE OR REPLACE FUNCTION public.recalc_settlement_provider_invoice_deductions(_settlement_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_sum numeric(14,2);
BEGIN
  IF _settlement_id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(amount),0)::numeric(14,2) INTO v_sum
  FROM public.purchase_invoice_provider_payments
  WHERE settlement_id = _settlement_id
    AND status = 'confirmed'
    AND reversed_at IS NULL;

  UPDATE public.payment_settlements
     SET provider_invoice_deductions_amount = v_sum,
         updated_at = now()
   WHERE id = _settlement_id;

  RETURN v_sum;
END $function$;

REVOKE ALL ON FUNCTION public.recalc_settlement_provider_invoice_deductions(uuid) FROM PUBLIC, anon;

-- 4) Preview / confirm deduction of a provider invoice inside a settlement
CREATE OR REPLACE FUNCTION public.preview_settlement_provider_invoice_deduction(
  p_settlement_id uuid, p_invoice_id bigint, p_amount numeric DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_set public.payment_settlements;
  v_inv public.purchase_invoices;
  v_base jsonb;
  v_amount numeric(14,2);
BEGIN
  IF NOT (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_any_finance_role(auth.uid())
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_set FROM public.payment_settlements WHERE id = p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;

  SELECT * INTO v_inv FROM public.purchase_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_inv.payment_provider_id IS DISTINCT FROM v_set.provider_id THEN
    RAISE EXCEPTION 'provider_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.purchase_invoice_provider_payments
    WHERE settlement_id = p_settlement_id AND purchase_invoice_id = p_invoice_id AND status <> 'reversed'
  ) THEN
    RAISE EXCEPTION 'invoice_already_linked_to_settlement';
  END IF;

  v_amount := COALESCE(p_amount, v_inv.remaining_amount);
  v_base := public.preview_provider_invoice_payment(p_invoice_id, v_amount);

  RETURN v_base || jsonb_build_object(
    'settlement', jsonb_build_object(
      'id', v_set.id,
      'reference', v_set.settlement_reference,
      'settlement_date', v_set.settlement_date,
      'source_expected_net_amount', v_set.source_expected_net_amount,
      'calculated_expected_net_amount', v_set.calculated_expected_net_amount,
      'expected_net_amount', v_set.expected_net_amount,
      'actual_bank_amount', v_set.actual_bank_amount,
      'current_provider_invoice_deductions', COALESCE(v_set.provider_invoice_deductions_amount,0),
      'new_provider_invoice_deductions', COALESCE(v_set.provider_invoice_deductions_amount,0) + v_amount,
      'new_expected_net_amount', COALESCE(v_set.expected_net_amount,0) - v_amount
    ),
    'supplier_invoice_number', v_inv.supplier_invoice_number,
    'internal_reference', v_inv.internal_reference
  );
END $function$;

CREATE OR REPLACE FUNCTION public.confirm_settlement_provider_invoice_deduction(
  p_settlement_id uuid, p_invoice_id bigint, p_amount numeric DEFAULT NULL, p_notes text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_set public.payment_settlements;
  v_inv public.purchase_invoices;
  v_amount numeric(14,2);
  v_res jsonb;
  v_pay_id uuid;
  v_ded numeric(14,2);
BEGIN
  IF NOT (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'finance_manage'::app_role)
    OR private.has_role(auth.uid(),'finance_accountant'::app_role)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_set FROM public.payment_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;
  IF v_set.status = 'cancelled' THEN RAISE EXCEPTION 'settlement_cancelled'; END IF;

  SELECT * INTO v_inv FROM public.purchase_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_inv.payment_provider_id IS DISTINCT FROM v_set.provider_id THEN
    RAISE EXCEPTION 'provider_mismatch';
  END IF;
  IF v_inv.status IN ('draft','rejected') THEN
    RAISE EXCEPTION 'invoice_not_payable_in_status_%', v_inv.status;
  END IF;
  IF COALESCE(v_inv.remaining_amount,0) <= 0 THEN RAISE EXCEPTION 'nothing_to_pay'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.purchase_invoice_provider_payments
    WHERE settlement_id = p_settlement_id AND purchase_invoice_id = p_invoice_id AND status <> 'reversed'
  ) THEN
    RAISE EXCEPTION 'invoice_already_linked_to_settlement';
  END IF;

  v_amount := COALESCE(p_amount, v_inv.remaining_amount);

  -- Reuse the existing wallet payment path (AP debit / provider clearing credit, draft entry).
  v_res := public.confirm_provider_invoice_payment(
    p_invoice_id, v_amount, COALESCE(v_set.settlement_date, CURRENT_DATE), NULL,
    COALESCE(p_notes, 'خصم فاتورة وسيط ضمن تسوية '||COALESCE(v_set.settlement_reference,''))
  );

  v_pay_id := (v_res->>'payment_id')::uuid;

  UPDATE public.purchase_invoice_provider_payments
     SET settlement_id = p_settlement_id
   WHERE id = v_pay_id;

  v_ded := public.recalc_settlement_provider_invoice_deductions(p_settlement_id);
  PERFORM public.recompute_settlement_status(p_settlement_id);

  INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, changed_by, note, new_value)
  VALUES (
    'purchase_invoice', p_invoice_id, 'settlement_provider_invoice_deduction_confirmed', auth.uid(),
    'خصم فاتورة وسيط ضمن تسوية '||COALESCE(v_set.settlement_reference,''),
    jsonb_build_object(
      'settlement_id', p_settlement_id,
      'payment_id', v_pay_id,
      'amount', v_amount,
      'journal_entry_id', v_res->>'journal_entry_id',
      'provider_invoice_deductions_amount', v_ded
    )::text
  );

  SELECT * INTO v_set FROM public.payment_settlements WHERE id = p_settlement_id;

  RETURN v_res || jsonb_build_object(
    'settlement_id', p_settlement_id,
    'provider_invoice_deductions_amount', v_ded,
    'expected_net_amount', v_set.expected_net_amount,
    'difference_amount', v_set.difference_amount
  );
END $function$;

REVOKE ALL ON FUNCTION public.preview_settlement_provider_invoice_deduction(uuid, bigint, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_settlement_provider_invoice_deduction(uuid, bigint, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_settlement_provider_invoice_deduction(uuid, bigint, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_settlement_provider_invoice_deduction(uuid, bigint, numeric, text) TO authenticated;

-- 5) Reversal keeps settlement deductions in sync
CREATE OR REPLACE FUNCTION public.reverse_provider_invoice_payment(p_payment_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_pay.settlement_id IS NOT NULL THEN
    PERFORM public.recalc_settlement_provider_invoice_deductions(v_pay.settlement_id);
    PERFORM public.recompute_settlement_status(v_pay.settlement_id);
  END IF;

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
      'settlement_id', v_pay.settlement_id,
      'journal_entry_id', v_pay.journal_entry_id,
      'reversal_entry_id', v_new_entry_id,
      'amount', v_pay.amount
    )::text
  );

  RETURN jsonb_build_object('payment_id', v_pay.id, 'reversal_entry_id', v_new_entry_id);
END $function$;