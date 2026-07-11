ALTER TABLE public.payment_settlements
  ALTER COLUMN settlement_date DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS payout_received_date date;

CREATE INDEX IF NOT EXISTS idx_ps_payout_received_date
  ON public.payment_settlements(payout_received_date);

CREATE OR REPLACE FUNCTION public.preview_auto_imported_settlement_dates()
RETURNS TABLE(affected_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.payment_settlements s
  LEFT JOIN public.payment_providers p ON p.id = s.provider_id
  WHERE s.settlement_date = DATE '2026-07-11'
    AND s.period_start IS NULL
    AND s.period_end IS NULL
    AND COALESCE(p.provider_code::text, '') = 'salla_payments'
    AND s.imported_at >= TIMESTAMPTZ '2026-07-11 00:00:00+00'
    AND s.imported_at < TIMESTAMPTZ '2026-07-13 00:00:00+00'
    AND (
      s.report_reference IS NULL
      OR s.settlement_reference LIKE 'salla_payments-%'
    );
$$;

REVOKE ALL ON FUNCTION public.preview_auto_imported_settlement_dates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_auto_imported_settlement_dates() TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_auto_imported_settlement_dates()
RETURNS TABLE(updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (private.has_role(v_uid,'admin'::app_role) OR private.has_role(v_uid,'finance_manage'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  WITH target AS (
    SELECT s.id
    FROM public.payment_settlements s
    LEFT JOIN public.payment_providers p ON p.id = s.provider_id
    WHERE s.settlement_date = DATE '2026-07-11'
      AND s.period_start IS NULL
      AND s.period_end IS NULL
      AND COALESCE(p.provider_code::text, '') = 'salla_payments'
      AND s.imported_at >= TIMESTAMPTZ '2026-07-11 00:00:00+00'
      AND s.imported_at < TIMESTAMPTZ '2026-07-13 00:00:00+00'
      AND (
        s.report_reference IS NULL
        OR s.settlement_reference LIKE 'salla_payments-%'
      )
  ), updated AS (
    UPDATE public.payment_settlements s
    SET settlement_date = NULL,
        updated_at = now()
    FROM target
    WHERE s.id = target.id
    RETURNING s.id
  )
  SELECT COUNT(*)::integer INTO updated_count FROM updated;

  INSERT INTO public.finance_audit_logs(related_type, action, changed_by, note, new_value)
  VALUES ('payment_settlements', 'clear_auto_imported_settlement_dates', v_uid,
    'Cleared settlement_date values that matched the import timestamp fallback pattern without changing imported_at, amounts, lines, or links.',
    updated_count::text);

  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.clear_auto_imported_settlement_dates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_auto_imported_settlement_dates() TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_settlement_allocation(
  _settlement_id uuid,
  _transaction_id uuid,
  _amount numeric,
  _difference_type settlement_allocation_difference_type DEFAULT NULL,
  _difference_note text DEFAULT NULL,
  _allow_over_settlement boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
      actual_bank_amount = COALESCE(actual_bank_amount, v_income.amount),
      updated_at = now()
  WHERE id = _settlement_id;

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note, new_value)
  VALUES ('settlement_allocation', v_id, 'allocation_confirmed', v_uid,
    format('settlement=%s income=%s amount=%s diff=%s type=%s payout_received_date=%s',
      _settlement_id, _transaction_id, _amount, COALESCE(v_diff,0), COALESCE(_difference_type::text,''), COALESCE(v_income.income_date::text,'')),
    _amount::text);

  PERFORM public.recompute_settlement_status(_settlement_id);
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.apply_settlement_allocation(uuid,uuid,numeric,settlement_allocation_difference_type,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_settlement_allocation(uuid,uuid,numeric,settlement_allocation_difference_type,text,boolean) TO authenticated;