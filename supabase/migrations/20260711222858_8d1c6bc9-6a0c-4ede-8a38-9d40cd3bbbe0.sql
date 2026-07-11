
-- 1) New columns on payment_settlements
ALTER TABLE public.payment_settlements
  ADD COLUMN IF NOT EXISTS adjustments_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS report_reference text,
  ADD COLUMN IF NOT EXISTS source_file_name text;

-- 2) payout_status enum + column
DO $$ BEGIN
  CREATE TYPE public.payment_settlement_payout_status AS ENUM ('awaiting_payout','received','partially_received');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payment_settlements
  ADD COLUMN IF NOT EXISTS payout_status public.payment_settlement_payout_status NOT NULL DEFAULT 'awaiting_payout';

-- 3) Recalculate function
CREATE OR REPLACE FUNCTION public.recalculate_settlement_totals(_settlement_id uuid)
RETURNS public.payment_settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross numeric := 0;
  v_refunds numeric := 0;
  v_fees numeric := 0;
  v_fees_vat numeric := 0;
  v_payout_fee numeric := 0;
  v_adjustments numeric := 0;
  v_reserve_held numeric := 0;
  v_reserve_released numeric := 0;
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

  SELECT
    COALESCE(SUM(CASE WHEN line_type='sale' AND amount>0 THEN amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='refund' THEN ABS(amount) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='fee' THEN ABS(amount) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='fee_vat' THEN ABS(amount) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='payout_fee' THEN ABS(amount) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='adjustment' THEN amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='reserve_held' THEN ABS(amount) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN line_type='reserve_released' THEN ABS(amount) ELSE 0 END),0)
  INTO v_gross, v_refunds, v_fees, v_fees_vat, v_payout_fee, v_adjustments, v_reserve_held, v_reserve_released
  FROM public.payment_settlement_lines
  WHERE settlement_id = _settlement_id;

  -- adjustments are signed: negative reduces expected, positive increases
  v_expected := ROUND(v_gross - v_refunds - v_fees - v_fees_vat - v_payout_fee + v_adjustments - v_reserve_held + v_reserve_released, 2);

  UPDATE public.payment_settlements
     SET gross_sales_amount = v_gross,
         refunds_amount = v_refunds,
         fees_before_vat = v_fees,
         fees_vat_amount = v_fees_vat,
         payout_fee = v_payout_fee,
         adjustments_amount = v_adjustments,
         reserve_held = v_reserve_held,
         reserve_released = v_reserve_released,
         expected_net_amount = v_expected,
         updated_at = now()
   WHERE id = _settlement_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_settlement_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_settlement_totals(uuid) TO authenticated;

-- 4) Backfill: recompute all existing settlements with the corrected formula
DO $$
DECLARE r record;
  v_gross numeric; v_refunds numeric; v_fees numeric; v_fees_vat numeric;
  v_payout_fee numeric; v_adjustments numeric; v_reserve_held numeric; v_reserve_released numeric;
  v_expected numeric;
BEGIN
  FOR r IN SELECT id FROM public.payment_settlements LOOP
    SELECT
      COALESCE(SUM(CASE WHEN line_type='sale' AND amount>0 THEN amount ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_type='refund' THEN ABS(amount) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_type='fee' THEN ABS(amount) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_type='fee_vat' THEN ABS(amount) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_type='payout_fee' THEN ABS(amount) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_type='adjustment' THEN amount ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_type='reserve_held' THEN ABS(amount) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_type='reserve_released' THEN ABS(amount) ELSE 0 END),0)
    INTO v_gross, v_refunds, v_fees, v_fees_vat, v_payout_fee, v_adjustments, v_reserve_held, v_reserve_released
    FROM public.payment_settlement_lines WHERE settlement_id = r.id;

    v_expected := ROUND(v_gross - v_refunds - v_fees - v_fees_vat - v_payout_fee + v_adjustments - v_reserve_held + v_reserve_released, 2);

    UPDATE public.payment_settlements
       SET gross_sales_amount = v_gross,
           refunds_amount = v_refunds,
           fees_before_vat = v_fees,
           fees_vat_amount = v_fees_vat,
           payout_fee = v_payout_fee,
           adjustments_amount = v_adjustments,
           reserve_held = v_reserve_held,
           reserve_released = v_reserve_released,
           expected_net_amount = v_expected,
           updated_at = now()
     WHERE id = r.id;
  END LOOP;
END $$;
