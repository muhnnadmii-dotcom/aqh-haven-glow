
CREATE TABLE public.aqh_finance_manual_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  cash_actual numeric(14,2) NOT NULL DEFAULT 0,
  inventory_value numeric(14,2) NOT NULL DEFAULT 0,
  assets_value numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_finance_manual_balances TO authenticated;
GRANT ALL ON public.aqh_finance_manual_balances TO service_role;

ALTER TABLE public.aqh_finance_manual_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read manual balances"
  ON public.aqh_finance_manual_balances FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_any_finance_role(auth.uid()));

CREATE POLICY "finance manage can insert manual balances"
  ON public.aqh_finance_manual_balances FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finance_manage'::public.app_role));

CREATE POLICY "finance manage can update manual balances"
  ON public.aqh_finance_manual_balances FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finance_manage'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finance_manage'::public.app_role));

CREATE POLICY "finance manage can delete manual balances"
  ON public.aqh_finance_manual_balances FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finance_manage'::public.app_role));

CREATE TRIGGER trg_manual_balances_touch
  BEFORE UPDATE ON public.aqh_finance_manual_balances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.aqh_finance_manual_balances (singleton) VALUES (true) ON CONFLICT DO NOTHING;
