
CREATE OR REPLACE FUNCTION public.compute_settlement_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.expected_net_amount :=
    COALESCE(NEW.gross_sales_amount,0)
    - COALESCE(NEW.refunds_amount,0)
    - COALESCE(NEW.fees_before_vat,0)
    - COALESCE(NEW.fees_vat_amount,0)
    - COALESCE(NEW.payout_fee,0)
    - COALESCE(NEW.other_deductions,0)
    + COALESCE(NEW.adjustments_amount,0)
    - COALESCE(NEW.reserve_held,0)
    + COALESCE(NEW.reserve_released,0);
  IF NEW.actual_bank_amount IS NOT NULL THEN
    NEW.difference_amount := NEW.actual_bank_amount - NEW.expected_net_amount;
  ELSE
    NEW.difference_amount := 0;
  END IF;
  RETURN NEW;
END $$;

-- Nudge all rows so the trigger recomputes
UPDATE public.payment_settlements SET updated_at = now();
