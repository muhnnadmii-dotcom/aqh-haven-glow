
-- Extend enum with new statuses
ALTER TYPE payment_settlement_status ADD VALUE IF NOT EXISTS 'fully_matched';
ALTER TYPE payment_settlement_status ADD VALUE IF NOT EXISTS 'closed';

-- Difference type enum
DO $$ BEGIN
  CREATE TYPE settlement_allocation_difference_type AS ENUM (
    'rounding_difference','payout_fee','bank_fee','reserve_held','reserve_released',
    'refund','adjustment','timing_difference','unknown_difference'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE settlement_allocation_status AS ENUM ('draft','confirmed','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allocations table
CREATE TABLE IF NOT EXISTS public.settlement_bank_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.payment_settlements(id) ON DELETE RESTRICT,
  transaction_id uuid NOT NULL REFERENCES public.finance_incomes(id) ON DELETE RESTRICT,
  allocated_amount numeric(14,2) NOT NULL CHECK (allocated_amount > 0),
  difference_amount numeric(14,2) NOT NULL DEFAULT 0,
  difference_type settlement_allocation_difference_type,
  difference_note text,
  status settlement_allocation_status NOT NULL DEFAULT 'confirmed',
  created_by uuid REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  reversed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sba_settlement ON public.settlement_bank_allocations(settlement_id) WHERE status <> 'reversed';
CREATE INDEX IF NOT EXISTS idx_sba_transaction ON public.settlement_bank_allocations(transaction_id) WHERE status <> 'reversed';
CREATE INDEX IF NOT EXISTS idx_sba_status ON public.settlement_bank_allocations(status);

GRANT SELECT, INSERT, UPDATE ON public.settlement_bank_allocations TO authenticated;
GRANT ALL ON public.settlement_bank_allocations TO service_role;

ALTER TABLE public.settlement_bank_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sba_read" ON public.settlement_bank_allocations;
CREATE POLICY "sba_read" ON public.settlement_bank_allocations FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));

DROP POLICY IF EXISTS "sba_write" ON public.settlement_bank_allocations;
CREATE POLICY "sba_write" ON public.settlement_bank_allocations FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'finance_manage'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'finance_manage'::app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_sba_updated_at ON public.settlement_bank_allocations;
CREATE TRIGGER trg_sba_updated_at BEFORE UPDATE ON public.settlement_bank_allocations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helpers: sums
CREATE OR REPLACE FUNCTION public.settlement_allocated_total(_settlement_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(SUM(allocated_amount),0)::numeric(14,2)
  FROM public.settlement_bank_allocations
  WHERE settlement_id = _settlement_id AND status = 'confirmed';
$$;

CREATE OR REPLACE FUNCTION public.income_allocated_total(_income_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(SUM(allocated_amount),0)::numeric(14,2)
  FROM public.settlement_bank_allocations
  WHERE transaction_id = _income_id AND status = 'confirmed';
$$;

REVOKE ALL ON FUNCTION public.settlement_allocated_total(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.income_allocated_total(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settlement_allocated_total(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.income_allocated_total(uuid) TO authenticated;

-- Recompute settlement status after allocation changes
CREATE OR REPLACE FUNCTION public.recompute_settlement_status(_settlement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  s RECORD;
  allocated numeric(14,2);
  expected numeric(14,2);
  new_status payment_settlement_status;
BEGIN
  SELECT * INTO s FROM public.payment_settlements WHERE id = _settlement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- Do not override terminal states
  IF s.status IN ('cancelled','closed') THEN RETURN; END IF;

  allocated := public.settlement_allocated_total(_settlement_id);
  expected := COALESCE(s.expected_net_amount, 0);

  IF allocated <= 0 THEN
    new_status := 'awaiting_payout';
  ELSIF ABS(allocated - expected) <= 0.05 THEN
    new_status := 'fully_matched';
  ELSIF allocated < expected THEN
    new_status := 'partially_matched';
  ELSE
    -- allocated > expected beyond tolerance: needs review
    new_status := 'under_review';
  END IF;

  IF new_status <> s.status THEN
    UPDATE public.payment_settlements SET status = new_status WHERE id = _settlement_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.recompute_settlement_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_settlement_status(uuid) TO authenticated;

-- Apply allocation (creates draft/confirmed, enforces caps, writes audit)
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

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note, new_value)
  VALUES ('settlement_allocation', v_id, 'allocation_confirmed', v_uid,
    format('settlement=%s income=%s amount=%s diff=%s type=%s',
      _settlement_id, _transaction_id, _amount, COALESCE(v_diff,0), COALESCE(_difference_type::text,'')),
    _amount::text);

  PERFORM public.recompute_settlement_status(_settlement_id);
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.apply_settlement_allocation(uuid,uuid,numeric,settlement_allocation_difference_type,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_settlement_allocation(uuid,uuid,numeric,settlement_allocation_difference_type,text,boolean) TO authenticated;

-- Reverse allocation
CREATE OR REPLACE FUNCTION public.reverse_settlement_allocation(
  _allocation_id uuid,
  _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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

  PERFORM public.recompute_settlement_status(v_row.settlement_id);
END $$;

REVOKE ALL ON FUNCTION public.reverse_settlement_allocation(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_settlement_allocation(uuid,text) TO authenticated;
