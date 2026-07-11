
CREATE OR REPLACE FUNCTION public.recalculate_settlement_totals(_settlement_id uuid)
RETURNS public.payment_settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross numeric := 0;
  v_refunds numeric := 0;
  v_adjustments numeric := 0;
  v_reserve_held numeric := 0;
  v_reserve_released numeric := 0;
  v_fees numeric := 0;
  v_fees_vat numeric := 0;
  v_payout_fee numeric := 0;
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

  -- Fees are stored at the header level (not as lines) — preserve them.
  SELECT COALESCE(fees_before_vat,0), COALESCE(fees_vat_amount,0), COALESCE(payout_fee,0)
    INTO v_fees, v_fees_vat, v_payout_fee
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

  v_expected := ROUND(v_gross - v_refunds - v_fees - v_fees_vat - v_payout_fee + v_adjustments - v_reserve_held + v_reserve_released, 2);

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
$$;

-- Restore original fees for the 4 existing settlements
UPDATE public.payment_settlements SET fees_before_vat=101.68, fees_vat_amount=15.27 WHERE id='019914fc-9dd8-4b26-a397-5dedd7986034';
UPDATE public.payment_settlements SET fees_before_vat=96.96,  fees_vat_amount=14.52 WHERE id='43619490-83f5-45ef-aa84-5baeaa32820b';
UPDATE public.payment_settlements SET fees_before_vat=123.13, fees_vat_amount=18.48 WHERE id='8981d79f-c95b-4e96-9b12-7353192b91af';
UPDATE public.payment_settlements SET fees_before_vat=140.06, fees_vat_amount=21.03 WHERE id='129dda48-f111-4dca-9f35-17dbaab51a1c';

-- Recompute expected_net_amount using the fixed formula (adjustments included, fees preserved)
UPDATE public.payment_settlements s
   SET expected_net_amount = ROUND(
         s.gross_sales_amount - s.refunds_amount - s.fees_before_vat - s.fees_vat_amount
         - COALESCE(s.payout_fee,0) + COALESCE(s.adjustments_amount,0)
         - COALESCE(s.reserve_held,0) + COALESCE(s.reserve_released,0), 2),
       updated_at = now();
