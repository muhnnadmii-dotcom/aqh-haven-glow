
-- 1) Central sync helper: refreshes actual_bank_amount, difference_amount,
--    bank_income_id (single-allocation only), status; and finance_incomes.settlement_id
CREATE OR REPLACE FUNCTION public.sync_settlement_links(_settlement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  allocated numeric(14,2);
  expected numeric(14,2);
  active_count int;
  single_income uuid;
  new_status payment_settlement_status;
  new_bank_income uuid;
BEGIN
  SELECT * INTO s FROM public.payment_settlements WHERE id = _settlement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*), COALESCE(SUM(allocated_amount),0)
    INTO active_count, allocated
  FROM public.settlement_bank_allocations
  WHERE settlement_id = _settlement_id AND status = 'confirmed';

  expected := COALESCE(s.expected_net_amount, 0);

  -- Recompute status (unless terminal)
  IF s.status NOT IN ('cancelled','closed') THEN
    IF allocated <= 0 THEN
      new_status := 'awaiting_payout';
    ELSIF ABS(allocated - expected) <= 0.05 THEN
      new_status := 'fully_matched';
    ELSIF allocated < expected THEN
      new_status := 'partially_matched';
    ELSE
      new_status := 'under_review';
    END IF;
  ELSE
    new_status := s.status;
  END IF;

  -- Determine bank_income_id: only if exactly one confirmed allocation on this settlement
  -- AND that income has no other confirmed allocations to other settlements.
  new_bank_income := NULL;
  IF active_count = 1 THEN
    SELECT transaction_id INTO single_income
    FROM public.settlement_bank_allocations
    WHERE settlement_id = _settlement_id AND status = 'confirmed'
    LIMIT 1;

    IF NOT EXISTS (
      SELECT 1 FROM public.settlement_bank_allocations
      WHERE transaction_id = single_income
        AND status = 'confirmed'
        AND settlement_id <> _settlement_id
    ) THEN
      -- Guard the partial unique index (uniq_ps_bank_income): make sure no other row already claims it
      IF NOT EXISTS (
        SELECT 1 FROM public.payment_settlements
        WHERE bank_income_id = single_income AND id <> _settlement_id
      ) THEN
        new_bank_income := single_income;
      END IF;
    END IF;
  END IF;

  UPDATE public.payment_settlements
  SET
    status = new_status,
    actual_bank_amount = CASE WHEN allocated > 0 THEN allocated ELSE NULL END,
    difference_amount  = CASE WHEN allocated > 0 THEN (allocated - expected) ELSE 0 END,
    bank_income_id     = new_bank_income,
    updated_at         = now()
  WHERE id = _settlement_id;
END $$;

-- 2) Sync per income row: set finance_incomes.settlement_id when exactly one
--    confirmed allocation exists for that income; otherwise NULL.
CREATE OR REPLACE FUNCTION public.sync_income_settlement_link(_income_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
  sid uuid;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.settlement_bank_allocations
  WHERE transaction_id = _income_id AND status = 'confirmed';

  IF cnt = 1 THEN
    SELECT settlement_id INTO sid
    FROM public.settlement_bank_allocations
    WHERE transaction_id = _income_id AND status = 'confirmed'
    LIMIT 1;
    UPDATE public.finance_incomes SET settlement_id = sid, updated_at = now()
    WHERE id = _income_id AND (settlement_id IS DISTINCT FROM sid);
  ELSE
    UPDATE public.finance_incomes SET settlement_id = NULL, updated_at = now()
    WHERE id = _income_id AND settlement_id IS NOT NULL;
  END IF;
END $$;

-- 3) Keep recompute_settlement_status callers working, but delegate to new helper
CREATE OR REPLACE FUNCTION public.recompute_settlement_status(_settlement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_settlement_links(_settlement_id);
END $$;

-- 4) apply_settlement_allocation: after insert, sync both sides
CREATE OR REPLACE FUNCTION public.apply_settlement_allocation(
  _settlement_id uuid, _transaction_id uuid, _amount numeric,
  _difference_type settlement_allocation_difference_type DEFAULT NULL,
  _difference_note text DEFAULT NULL,
  _allow_over_settlement boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SET payout_received_date = v_income.income_date
  WHERE id = _settlement_id;

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note, new_value)
  VALUES ('settlement_allocation', v_id, 'allocation_confirmed', v_uid,
    format('settlement=%s income=%s amount=%s diff=%s type=%s payout_received_date=%s',
      _settlement_id, _transaction_id, _amount, COALESCE(v_diff,0), COALESCE(_difference_type::text,''), COALESCE(v_income.income_date::text,'')),
    _amount::text);

  PERFORM public.sync_settlement_links(_settlement_id);
  PERFORM public.sync_income_settlement_link(_transaction_id);
  RETURN v_id;
END $$;

-- 5) reverse_settlement_allocation: sync both sides after reversal
CREATE OR REPLACE FUNCTION public.reverse_settlement_allocation(_allocation_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_uid uuid := auth.uid();
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

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note)
  VALUES ('settlement_allocation', _allocation_id, 'allocation_reversed', v_uid,
    format('reason=%s', _reason));

  PERFORM public.sync_settlement_links(v_row.settlement_id);
  PERFORM public.sync_income_settlement_link(v_row.transaction_id);
END $$;

-- 6) Backfill: resync every settlement + every income that has (or had) allocations
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.payment_settlements LOOP
    PERFORM public.sync_settlement_links(r.id);
  END LOOP;
  FOR r IN SELECT DISTINCT transaction_id AS id FROM public.settlement_bank_allocations LOOP
    PERFORM public.sync_income_settlement_link(r.id);
  END LOOP;
END $$;

-- 7) Lock down EXECUTE (SECURITY DEFINER hardening)
REVOKE EXECUTE ON FUNCTION public.sync_settlement_links(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_income_settlement_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_settlement_links(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_income_settlement_link(uuid) TO authenticated;
