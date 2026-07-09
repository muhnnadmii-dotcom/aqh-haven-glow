
CREATE TABLE public.aqh_finance_capital (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL CHECK (entry_type IN ('opening_balance','capital_injection','owner_withdrawal')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX aqh_finance_capital_single_opening
  ON public.aqh_finance_capital ((entry_type))
  WHERE entry_type = 'opening_balance';

CREATE INDEX aqh_finance_capital_date_idx ON public.aqh_finance_capital(entry_date);
CREATE INDEX aqh_finance_capital_type_idx ON public.aqh_finance_capital(entry_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_finance_capital TO authenticated;
GRANT ALL ON public.aqh_finance_capital TO service_role;

ALTER TABLE public.aqh_finance_capital ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read capital"
  ON public.aqh_finance_capital FOR SELECT
  TO authenticated
  USING (
    private.has_role(auth.uid(),'admin')
    OR private.has_any_finance_role(auth.uid())
  );

CREATE POLICY "finance manage can insert capital"
  ON public.aqh_finance_capital FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(),'admin')
    OR private.has_role(auth.uid(),'finance_manage')
  );

CREATE POLICY "finance manage can update capital"
  ON public.aqh_finance_capital FOR UPDATE
  TO authenticated
  USING (
    private.has_role(auth.uid(),'admin')
    OR private.has_role(auth.uid(),'finance_manage')
  )
  WITH CHECK (
    private.has_role(auth.uid(),'admin')
    OR private.has_role(auth.uid(),'finance_manage')
  );

CREATE POLICY "finance manage can delete capital"
  ON public.aqh_finance_capital FOR DELETE
  TO authenticated
  USING (
    private.has_role(auth.uid(),'admin')
    OR private.has_role(auth.uid(),'finance_manage')
  );

CREATE TRIGGER aqh_finance_capital_touch
  BEFORE UPDATE ON public.aqh_finance_capital
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
