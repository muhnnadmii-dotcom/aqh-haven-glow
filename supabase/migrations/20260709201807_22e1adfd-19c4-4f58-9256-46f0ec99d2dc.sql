ALTER TABLE public.aqh_finance_manual_balances ADD COLUMN IF NOT EXISTS cash_anchor_date date;

UPDATE public.aqh_finance_manual_balances SET cash_anchor_date = COALESCE(cash_anchor_date, current_date);

CREATE OR REPLACE FUNCTION public.aqh_manual_balances_set_cash_anchor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cash_anchor_date IS NULL THEN NEW.cash_anchor_date := current_date; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cash_actual IS DISTINCT FROM OLD.cash_actual THEN
      NEW.cash_anchor_date := current_date;
    END IF;
  END IF;
  RETURN NEW;
END$$;

REVOKE ALL ON FUNCTION public.aqh_manual_balances_set_cash_anchor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_manual_balances_cash_anchor ON public.aqh_finance_manual_balances;
CREATE TRIGGER trg_manual_balances_cash_anchor
BEFORE INSERT OR UPDATE ON public.aqh_finance_manual_balances
FOR EACH ROW EXECUTE FUNCTION public.aqh_manual_balances_set_cash_anchor();