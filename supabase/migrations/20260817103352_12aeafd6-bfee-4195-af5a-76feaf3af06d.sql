-- =====================================================================
-- 1) Provider-safe payment evidence
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sales_invoice_payment_evidence(p_invoice_id bigint)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_provider public.sales_payment_provider;
  v_settle numeric(14,2) := 0;
  v_income numeric(14,2) := 0;
BEGIN
  IF p_invoice_id IS NULL THEN RETURN 0; END IF;

  SELECT payment_provider INTO v_provider FROM public.sales_invoices WHERE id = p_invoice_id;

  SELECT COALESCE(SUM(
           CASE
             WHEN l.line_type = 'sale' THEN l.amount
             WHEN l.line_type IN ('refund','partial_refund','chargeback') THEN -ABS(l.amount)
             ELSE 0
           END), 0)
    INTO v_settle
  FROM public.payment_settlement_lines l
  JOIN public.payment_settlements s ON s.id = l.settlement_id
  JOIN public.payment_providers pp ON pp.id = s.provider_id
  WHERE l.sales_invoice_id = p_invoice_id
    AND s.status <> 'cancelled'
    AND pp.provider_code::text = v_provider::text;

  SELECT COALESCE(SUM(amount),0) INTO v_income
  FROM public.finance_incomes
  WHERE sales_invoice_id = p_invoice_id AND deleted_at IS NULL;

  IF v_provider IN ('salla_payments','tabby','tamara') THEN
    RETURN GREATEST(ROUND(CASE WHEN v_settle <> 0 THEN v_settle ELSE v_income END, 2), 0);
  END IF;

  RETURN GREATEST(ROUND(CASE WHEN v_income <> 0 THEN v_income ELSE v_settle END, 2), 0);
END $function$;

-- =====================================================================
-- 2) Collection journal draft synchronization (draft only, idempotent)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ensure_sales_collection_journal(p_invoice_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv RECORD;
  v_evidence numeric(14,2);
  v_provider_count int;
  v_clearing uuid;
  v_ar uuid := public.acct_id('accounts_receivable');
  v_entry_date date;
  v_start date;
  v_je RECORD;
BEGIN
  IF p_invoice_id IS NULL OR v_ar IS NULL THEN RETURN 'skipped'; END IF;

  SELECT id, invoice_number, customer_id, issue_date, status, payment_provider
    INTO v_inv FROM public.sales_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN 'skipped'; END IF;
  IF v_inv.status IN ('draft','cancelled') THEN RETURN 'skipped'; END IF;
  IF v_inv.payment_provider::text NOT IN ('salla_payments','tabby','tamara') THEN RETURN 'skipped'; END IF;

  v_evidence := public.sales_invoice_payment_evidence(p_invoice_id);
  IF COALESCE(v_evidence,0) <= 0 THEN RETURN 'skipped'; END IF;

  SELECT COUNT(DISTINCT s.provider_id),
         MAX(pp.clearing_account_id::text)::uuid,
         MAX(l.transaction_date),
         MAX(s.settlement_date)
    INTO v_provider_count, v_clearing, v_entry_date, v_start
  FROM public.payment_settlement_lines l
  JOIN public.payment_settlements s ON s.id = l.settlement_id
  JOIN public.payment_providers pp ON pp.id = s.provider_id
  WHERE l.sales_invoice_id = p_invoice_id
    AND s.status <> 'cancelled'
    AND pp.provider_code::text = v_inv.payment_provider::text;

  IF COALESCE(v_provider_count,0) <> 1 OR v_clearing IS NULL THEN RETURN 'skipped'; END IF;

  v_entry_date := COALESCE(v_entry_date, v_start, v_inv.issue_date);

  SELECT accounting_start_date INTO v_start FROM public.accounting_settings WHERE id = 1;
  IF v_start IS NOT NULL AND v_entry_date < v_start THEN RETURN 'skipped_before_start'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE source_type = 'sales_invoice_approval'
      AND source_id = p_invoice_id::text
      AND status <> 'reversed'
  ) THEN
    RETURN 'missing_approval';
  END IF;

  SELECT * INTO v_je FROM public.journal_entries
  WHERE source_type = 'sales_invoice_collection'
    AND source_id = p_invoice_id::text
    AND status <> 'reversed'
  ORDER BY created_at LIMIT 1;

  IF FOUND THEN
    IF v_je.status = 'posted' THEN
      IF ROUND(COALESCE(v_je.total_debit,0),2) <> v_evidence
         OR NOT EXISTS (SELECT 1 FROM public.journal_entry_lines
                        WHERE journal_entry_id = v_je.id AND account_id = v_clearing AND debit > 0) THEN
        RETURN 'posted_mismatch';
      END IF;
      RETURN 'ok_posted';
    END IF;

    UPDATE public.journal_entries
      SET entry_date = v_entry_date,
          description = 'تحصيل فاتورة ' || COALESCE(v_inv.invoice_number,'') || ' عبر ' || v_inv.payment_provider::text,
          period_id = public.ensure_accounting_period(v_entry_date),
          updated_at = now()
      WHERE id = v_je.id;
    DELETE FROM public.journal_entry_lines WHERE journal_entry_id = v_je.id;
  ELSE
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (v_entry_date,
            'تحصيل فاتورة ' || COALESCE(v_inv.invoice_number,'') || ' عبر ' || v_inv.payment_provider::text,
            'sales_invoice_collection', p_invoice_id::text, 'draft')
    RETURNING * INTO v_je;
  END IF;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
  VALUES
    (v_je.id, v_clearing, 'حساب وسيط ' || v_inv.payment_provider::text, v_evidence, 0, NULL, 1),
    (v_je.id, v_ar, 'ذمم عميل - ' || COALESCE(v_inv.invoice_number,''), 0, v_evidence, v_inv.customer_id, 2);

  RETURN 'draft_synced';
END $function$;

-- =====================================================================
-- 3) Single idempotent gateway invoice synchronization helper
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_gateway_sales_invoice(p_invoice_id bigint, p_create_draft boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv RECORD;
  v_net numeric(14,2);
  v_eff numeric(14,2);
  v_ev  numeric(14,2);
  v_tol numeric(14,4) := 0.05;
  v_journal text := 'skipped';
BEGIN
  IF p_invoice_id IS NULL THEN RETURN 'skipped'; END IF;

  -- recursion guard
  IF current_setting('app.sync_gsi', true) = p_invoice_id::text THEN RETURN 'recursion_guard'; END IF;
  PERFORM set_config('app.sync_gsi', p_invoice_id::text, true);

  SELECT * INTO v_inv FROM public.sales_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM set_config('app.sync_gsi', '', true);
    RETURN 'skipped';
  END IF;

  PERFORM public.recompute_sales_invoice_settlement_status(p_invoice_id);

  SELECT COALESCE(SUM(CASE WHEN note_type = 'sales_credit_note' THEN -total_amount ELSE total_amount END), 0)
    INTO v_net
    FROM public.credit_debit_notes
    WHERE original_sales_invoice_id = p_invoice_id
      AND status = 'approved'
      AND note_type IN ('sales_credit_note','sales_debit_note');

  v_eff := GREATEST(COALESCE(v_inv.total_amount,0) + COALESCE(v_net,0), 0);
  v_ev  := public.sales_invoice_payment_evidence(p_invoice_id);

  SELECT COALESCE(pp.rounding_tolerance, 0.05) INTO v_tol
  FROM public.payment_providers pp
  WHERE pp.provider_code::text = v_inv.payment_provider::text
  LIMIT 1;
  v_tol := COALESCE(v_tol, 0.05);

  UPDATE public.sales_invoices SET
    paid_amount = v_ev,
    remaining_amount = GREATEST(v_eff - v_ev, 0),
    payment_status = CASE
      WHEN v_ev <= 0 THEN 'unpaid'::public.sales_invoice_payment_status
      WHEN v_ev > v_eff + v_tol THEN 'overpaid'::public.sales_invoice_payment_status
      WHEN v_ev + v_tol < v_eff THEN 'partially_paid'::public.sales_invoice_payment_status
      ELSE 'paid'::public.sales_invoice_payment_status
    END,
    status = CASE
      WHEN v_inv.status IN ('draft','cancelled') THEN v_inv.status
      WHEN v_ev <= 0 THEN 'approved'::public.sales_invoice_status
      WHEN v_ev + v_tol < v_eff THEN 'partially_paid'::public.sales_invoice_status
      ELSE 'paid'::public.sales_invoice_status
    END
  WHERE id = p_invoice_id;

  IF p_create_draft THEN
    v_journal := public.ensure_sales_collection_journal(p_invoice_id);
  END IF;

  PERFORM set_config('app.sync_gsi', '', true);
  RETURN v_journal;
END $function$;

-- keep standard recalculation from erasing the synchronized payment result
CREATE OR REPLACE FUNCTION public.sales_invoice_recalc_totals(p_invoice_id bigint)
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
  v_paid numeric(14,2) := 0;
  v_current_status public.sales_invoice_status;
  v_provider text;
BEGIN
  SELECT
    COALESCE(SUM(ROUND(quantity*unit_price,2)),0),
    COALESCE(SUM(discount_amount),0),
    COALESCE(SUM(line_subtotal),0),
    COALESCE(SUM(line_tax_amount),0),
    COALESCE(SUM(line_total),0)
  INTO v_sub, v_disc, v_taxable, v_vat, v_total
  FROM public.sales_invoice_items WHERE invoice_id = p_invoice_id;

  v_paid := public.sales_invoice_payment_evidence(p_invoice_id);

  SELECT status, payment_provider::text INTO v_current_status, v_provider
    FROM public.sales_invoices WHERE id = p_invoice_id;

  UPDATE public.sales_invoices SET
    subtotal = v_sub,
    discount_amount = v_disc,
    taxable_amount = v_taxable,
    vat_amount = v_vat,
    total_amount = v_total,
    paid_amount = v_paid,
    remaining_amount = GREATEST(v_total - v_paid, 0),
    payment_status = CASE
      WHEN v_paid <= 0 THEN 'unpaid'::public.sales_invoice_payment_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.sales_invoice_payment_status
      WHEN v_paid = v_total THEN 'paid'::public.sales_invoice_payment_status
      ELSE 'overpaid'::public.sales_invoice_payment_status
    END,
    status = CASE
      WHEN v_current_status IN ('draft','cancelled') THEN v_current_status
      WHEN v_paid <= 0 THEN 'approved'::public.sales_invoice_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.sales_invoice_status
      WHEN v_paid >= v_total THEN 'paid'::public.sales_invoice_status
      ELSE v_current_status
    END
  WHERE id = p_invoice_id;

  PERFORM public.cdn_sync_sales_invoice(p_invoice_id);

  IF v_provider IN ('salla_payments','tabby','tamara') THEN
    PERFORM public.sync_gateway_sales_invoice(p_invoice_id, false);
  END IF;
END $function$;

-- =====================================================================
-- 4) Trigger integration on settlement lines
-- =====================================================================
CREATE OR REPLACE FUNCTION public._psl_recompute_invoice_settlement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old bigint;
  v_new bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := OLD.sales_invoice_id; v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL; v_new := NEW.sales_invoice_id;
  ELSE
    v_old := OLD.sales_invoice_id; v_new := NEW.sales_invoice_id;
  END IF;

  IF v_old IS NOT NULL THEN
    PERFORM public.sync_gateway_sales_invoice(v_old, true);
  END IF;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    PERFORM public.sync_gateway_sales_invoice(v_new, true);
  END IF;

  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public._ps_status_recompute_invoices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    FOR v_id IN
      SELECT DISTINCT sales_invoice_id
      FROM public.payment_settlement_lines
      WHERE settlement_id = NEW.id AND sales_invoice_id IS NOT NULL
    LOOP
      PERFORM public.sync_gateway_sales_invoice(v_id, true);
    END LOOP;
  END IF;
  RETURN NULL;
END $function$;

-- =====================================================================
-- 5) Payout journal draft synchronization
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ensure_settlement_payout_journal(p_allocation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_cash uuid := public.acct_id('cash_bank');
  v_je RECORD;
  v_amount numeric(14,2);
BEGIN
  IF p_allocation_id IS NULL OR v_cash IS NULL THEN RETURN 'skipped'; END IF;

  SELECT sba.id, sba.allocated_amount, sba.status,
         fi.income_date, fi.account_id AS finance_account_id,
         pp.provider_code::text AS provider_code, pp.clearing_account_id,
         ps.status::text AS settlement_status
    INTO v_row
  FROM public.settlement_bank_allocations sba
  JOIN public.payment_settlements ps ON ps.id = sba.settlement_id
  JOIN public.payment_providers pp   ON pp.id = ps.provider_id
  JOIN public.finance_incomes fi     ON fi.id = sba.transaction_id
  WHERE sba.id = p_allocation_id
    AND sba.status = 'confirmed'
    AND fi.deleted_at IS NULL
    AND ps.status <> 'cancelled';

  IF NOT FOUND OR v_row.clearing_account_id IS NULL THEN RETURN 'skipped'; END IF;

  v_amount := ROUND(COALESCE(v_row.allocated_amount,0), 2);
  IF v_amount <= 0 THEN RETURN 'skipped'; END IF;

  SELECT * INTO v_je FROM public.journal_entries
  WHERE source_type = 'payment_settlement_payout'
    AND source_id = p_allocation_id::text
    AND status <> 'reversed'
  ORDER BY created_at LIMIT 1;

  IF FOUND THEN
    IF v_je.status = 'posted' THEN
      IF ROUND(COALESCE(v_je.total_debit,0),2) <> v_amount THEN RETURN 'posted_mismatch'; END IF;
      RETURN 'ok_posted';
    END IF;
    UPDATE public.journal_entries
      SET entry_date = v_row.income_date,
          description = 'وصول تسوية ' || v_row.provider_code,
          period_id = public.ensure_accounting_period(v_row.income_date),
          updated_at = now()
      WHERE id = v_je.id;
    DELETE FROM public.journal_entry_lines WHERE journal_entry_id = v_je.id;
  ELSE
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (v_row.income_date, 'وصول تسوية ' || v_row.provider_code,
            'payment_settlement_payout', p_allocation_id::text, 'draft')
    RETURNING * INTO v_je;
  END IF;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
  VALUES
    (v_je.id, v_cash, 'نقد وبنوك — تسوية ' || v_row.provider_code, v_amount, 0, v_row.finance_account_id, 1),
    (v_je.id, v_row.clearing_account_id, 'إغلاق حساب وسيط ' || v_row.provider_code, 0, v_amount, NULL, 2);

  RETURN 'draft_synced';
END $function$;

CREATE OR REPLACE FUNCTION public.apply_settlement_allocation(_settlement_id uuid, _transaction_id uuid, _amount numeric, _difference_type settlement_allocation_difference_type DEFAULT NULL::settlement_allocation_difference_type, _difference_note text DEFAULT NULL::text, _allow_over_settlement boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_income RECORD;
  v_settle RECORD;
  income_used numeric(14,2);
  settlement_used numeric(14,2);
  income_remaining numeric(14,2);
  settlement_remaining numeric(14,2);
  v_diff numeric(14,2);
  v_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (private.has_role(v_uid,'admin'::app_role) OR private.has_role(v_uid,'finance_manage'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT * INTO v_settle FROM public.payment_settlements WHERE id=_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;
  SELECT * INTO v_income FROM public.finance_incomes WHERE id=_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'income_not_found'; END IF;
  IF v_income.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'income_deleted'; END IF;

  income_used := public.income_allocated_total(_transaction_id);
  income_remaining := v_income.amount - income_used;
  IF _amount > income_remaining + 0.0001 THEN
    RAISE EXCEPTION 'exceeds_income_remaining' USING DETAIL = income_remaining::text;
  END IF;

  settlement_used := public.settlement_allocated_total(_settlement_id);
  settlement_remaining := v_settle.expected_net_amount - settlement_used;
  v_diff := _amount - settlement_remaining;

  IF _amount > settlement_remaining + 0.05 AND NOT _allow_over_settlement THEN
    RAISE EXCEPTION 'exceeds_settlement_remaining' USING DETAIL = settlement_remaining::text;
  END IF;

  INSERT INTO public.settlement_bank_allocations(
    settlement_id, transaction_id, allocated_amount,
    difference_amount, difference_type, difference_note,
    status, created_by, confirmed_by, confirmed_at
  ) VALUES (
    _settlement_id, _transaction_id, _amount,
    COALESCE(v_diff,0), _difference_type, _difference_note,
    'confirmed', v_uid, v_uid, now()
  ) RETURNING id INTO v_id;

  UPDATE public.payment_settlements
  SET payout_received_date = v_income.income_date,
      settlement_date = COALESCE(settlement_date, v_income.income_date)
  WHERE id = _settlement_id;

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note, new_value)
  VALUES ('settlement_allocation', v_id, 'allocation_confirmed', v_uid,
    format('settlement=%s income=%s amount=%s diff=%s type=%s payout_received_date=%s',
      _settlement_id, _transaction_id, _amount, COALESCE(v_diff,0), COALESCE(_difference_type::text,''), COALESCE(v_income.income_date::text,'')),
    _amount::text);

  PERFORM public.sync_settlement_links(_settlement_id);
  PERFORM public.sync_income_settlement_link(_transaction_id);
  PERFORM public.ensure_settlement_payout_journal(v_id);
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.reverse_settlement_allocation(_allocation_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_uid uuid := auth.uid();
  v_je RECORD;
BEGIN
  IF NOT (private.has_role(v_uid,'admin'::app_role) OR private.has_role(v_uid,'finance_manage'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF _reason IS NULL OR length(trim(_reason))=0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT * INTO v_row FROM public.settlement_bank_allocations WHERE id=_allocation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'allocation_not_found'; END IF;
  IF v_row.status = 'reversed' THEN RAISE EXCEPTION 'already_reversed'; END IF;

  UPDATE public.settlement_bank_allocations
    SET status='reversed', reversed_at=now(), reversed_by=v_uid, reversal_reason=_reason
    WHERE id=_allocation_id;

  SELECT * INTO v_je FROM public.journal_entries
  WHERE source_type='payment_settlement_payout'
    AND source_id=_allocation_id::text
    AND status <> 'reversed'
  ORDER BY created_at LIMIT 1;

  IF FOUND THEN
    IF v_je.status = 'draft' THEN
      DELETE FROM public.journal_entry_lines WHERE journal_entry_id = v_je.id;
      DELETE FROM public.journal_entries WHERE id = v_je.id;
      INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note)
      VALUES ('settlement_allocation', _allocation_id, 'payout_draft_removed', v_uid,
              format('entry=%s', v_je.entry_number));
    ELSE
      PERFORM public.reverse_journal_entry(v_je.id, 'عكس تخصيص تسوية: ' || _reason);
      INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note)
      VALUES ('settlement_allocation', _allocation_id, 'payout_journal_reversed', v_uid,
              format('entry=%s', v_je.entry_number));
    END IF;
  END IF;

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note)
  VALUES ('settlement_allocation', _allocation_id, 'allocation_reversed', v_uid,
    format('reason=%s', _reason));

  PERFORM public.sync_settlement_links(v_row.settlement_id);
  PERFORM public.sync_income_settlement_link(v_row.transaction_id);
END $function$;

REVOKE ALL ON FUNCTION public.sync_gateway_sales_invoice(bigint, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_sales_collection_journal(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_settlement_payout_journal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_gateway_sales_invoice(bigint, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_sales_collection_journal(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_settlement_payout_journal(uuid) TO service_role;

-- =====================================================================
-- 6) Safe backfill (validated against live data; aborts on mismatch)
-- =====================================================================
DO $backfill$
DECLARE
  v_status_cnt int;
  v_coll_cnt int;
  v_coll_total numeric;
  v_pay_cnt int;
  v_pay_total numeric;
  v_id bigint;
  v_res text;
  v_fixed int := 0;
  v_created int := 0;
  v_missing_appr int := 0;
  v_mismatch int := 0;
  v_pay_created int := 0;
BEGIN
  CREATE TEMP TABLE _bf_ev ON COMMIT DROP AS
  WITH ev AS (
    SELECT si.id, si.payment_provider::text AS prov, si.total_amount, si.status::text AS istat,
           si.payment_status::text AS pstat, si.issue_date,
           COALESCE(SUM(CASE WHEN psl.line_type='sale' THEN psl.amount
                             WHEN psl.line_type IN ('refund','partial_refund','chargeback') THEN -ABS(psl.amount)
                             ELSE 0 END),0) AS evidence,
           COUNT(DISTINCT pst.provider_id) AS pcount,
           MAX(psl.transaction_date) AS last_txn,
           MAX(pst.settlement_date) AS sdate
    FROM public.sales_invoices si
    LEFT JOIN public.payment_settlement_lines psl ON psl.sales_invoice_id = si.id
    LEFT JOIN public.payment_settlements pst ON pst.id = psl.settlement_id AND pst.status <> 'cancelled'
      AND EXISTS (SELECT 1 FROM public.payment_providers pp WHERE pp.id = pst.provider_id AND pp.provider_code::text = si.payment_provider::text)
    WHERE si.payment_provider::text IN ('salla_payments','tabby','tamara')
    GROUP BY si.id
  ), cdn AS (
    SELECT original_sales_invoice_id AS iid,
           COALESCE(SUM(CASE WHEN note_type='sales_credit_note' THEN -total_amount ELSE total_amount END),0) AS net
    FROM public.credit_debit_notes
    WHERE status='approved' AND note_type IN ('sales_credit_note','sales_debit_note')
    GROUP BY 1
  )
  SELECT ev.*, GREATEST(ev.total_amount + COALESCE(cdn.net,0),0) AS eff,
         ROUND(GREATEST(ev.evidence,0),2) AS ev2
  FROM ev LEFT JOIN cdn ON cdn.iid = ev.id;

  SELECT COUNT(*) INTO v_status_cnt FROM _bf_ev
   WHERE pstat='unpaid' AND ev2 > 0 AND istat NOT IN ('draft','cancelled') AND id <> 2208;

  SELECT COUNT(*), COALESCE(ROUND(SUM(ev2),2),0) INTO v_coll_cnt, v_coll_total
  FROM _bf_ev e
  WHERE e.ev2 > 0 AND e.istat NOT IN ('draft','cancelled') AND e.pcount = 1 AND e.id <> 2208
    AND COALESCE(e.last_txn, e.sdate, e.issue_date) >= DATE '2026-07-16'
    AND EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.source_type='sales_invoice_approval' AND je.source_id=e.id::text AND je.status<>'reversed')
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.source_type='sales_invoice_collection' AND je.source_id=e.id::text AND je.status<>'reversed');

  SELECT COUNT(*), COALESCE(ROUND(SUM(sba.allocated_amount),2),0) INTO v_pay_cnt, v_pay_total
  FROM public.settlement_bank_allocations sba
  JOIN public.payment_settlements ps ON ps.id = sba.settlement_id
  JOIN public.payment_providers pp ON pp.id = ps.provider_id
  JOIN public.finance_incomes fi ON fi.id = sba.transaction_id
  WHERE sba.status='confirmed' AND fi.deleted_at IS NULL AND ps.status <> 'cancelled'
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.source_type='payment_settlement_payout' AND je.source_id=sba.id::text AND je.status<>'reversed');

  IF v_status_cnt <> 18 THEN
    RAISE EXCEPTION 'safety mismatch (status candidates): actual=% expected=18', v_status_cnt;
  END IF;
  IF v_coll_cnt <> 102 OR v_coll_total <> 29689.81 THEN
    RAISE EXCEPTION 'safety mismatch (collections): actual=%/% expected=102/29689.81', v_coll_cnt, v_coll_total;
  END IF;
  IF v_pay_cnt <> 2 OR v_pay_total <> 6034.98 THEN
    RAISE EXCEPTION 'safety mismatch (payouts): actual=%/% expected=2/6034.98', v_pay_cnt, v_pay_total;
  END IF;

  FOR v_id IN
    SELECT DISTINCT e.id FROM _bf_ev e
    WHERE e.id <> 2208 AND e.istat NOT IN ('draft','cancelled') AND e.ev2 > 0
      AND (e.pstat = 'unpaid'
        OR (e.pcount = 1
            AND COALESCE(e.last_txn, e.sdate, e.issue_date) >= DATE '2026-07-16'
            AND EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.source_type='sales_invoice_approval' AND je.source_id=e.id::text AND je.status<>'reversed')
            AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.source_type='sales_invoice_collection' AND je.source_id=e.id::text AND je.status<>'reversed')))
    ORDER BY 1
  LOOP
    v_res := public.sync_gateway_sales_invoice(v_id, true);
    v_fixed := v_fixed + 1;
    IF v_res = 'draft_synced' THEN v_created := v_created + 1;
    ELSIF v_res = 'missing_approval' THEN v_missing_appr := v_missing_appr + 1;
    ELSIF v_res = 'posted_mismatch' THEN v_mismatch := v_mismatch + 1;
    END IF;
  END LOOP;

  FOR v_id IN SELECT 1 LOOP END LOOP; -- no-op

  PERFORM public.ensure_settlement_payout_journal('134aa10c-a458-4df7-8224-c9f97f09ee32'::uuid);
  PERFORM public.ensure_settlement_payout_journal('4b7916a1-0862-435c-afed-10a17af80212'::uuid);
  SELECT COUNT(*) INTO v_pay_created FROM public.journal_entries
   WHERE source_type='payment_settlement_payout'
     AND source_id IN ('134aa10c-a458-4df7-8224-c9f97f09ee32','4b7916a1-0862-435c-afed-10a17af80212')
     AND status='draft';

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note, new_value)
  VALUES ('settlement_allocation', gen_random_uuid(), 'gateway_sync_backfill', NULL,
    format('invoices_synced=%s collection_drafts_created=%s missing_approval=%s posted_mismatch=%s payout_drafts=%s payout_total=%s collection_total=%s excluded_invoice=2208',
      v_fixed, v_created, v_missing_appr, v_mismatch, v_pay_created, v_pay_total, v_coll_total),
    v_coll_total::text);

  RAISE NOTICE 'backfill: invoices=% collection_drafts=% missing_approval=% posted_mismatch=% payout_drafts=%',
    v_fixed, v_created, v_missing_appr, v_mismatch, v_pay_created;
END
$backfill$;