
-- ============================================================================
-- Payment Providers & Manual Settlements Module (Salla / Tabby / Tamara)
-- ============================================================================

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.payment_provider_type AS ENUM ('payment_gateway','bnpl','marketplace');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_settlement_status AS ENUM (
    'draft','imported','under_review','matched','partially_matched',
    'awaiting_payout','paid','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_settlement_line_type AS ENUM (
    'sale','refund','fee','fee_vat','payout_fee','adjustment',
    'reserve_held','reserve_released','rounding_difference','unexplained_transfer_fee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Clearing accounts in the chart of accounts (assets, non-cash)
INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, account_subtype, is_system, is_active, allow_manual_entries, system_key)
VALUES
  ('1710','مستحقات لدى سلة','Receivable from Salla','asset','provider_clearing', true, true, false, 'clearing_salla'),
  ('1720','مستحقات لدى تابي','Receivable from Tabby','asset','provider_clearing', true, true, false, 'clearing_tabby'),
  ('1730','مستحقات لدى تمارا','Receivable from Tamara','asset','provider_clearing', true, true, false, 'clearing_tamara')
ON CONFLICT (code) DO NOTHING;

-- 3) payment_providers
CREATE TABLE IF NOT EXISTS public.payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_code public.sales_payment_provider NOT NULL UNIQUE,
  provider_type public.payment_provider_type NOT NULL,
  supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  clearing_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  rounding_tolerance numeric(12,4) NOT NULL DEFAULT 0.05,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_providers TO authenticated;
GRANT ALL ON public.payment_providers TO service_role;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pp_read ON public.payment_providers;
CREATE POLICY pp_read ON public.payment_providers FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
DROP POLICY IF EXISTS pp_write ON public.payment_providers;
CREATE POLICY pp_write ON public.payment_providers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

DROP TRIGGER IF EXISTS trg_pp_updated_at ON public.payment_providers;
CREATE TRIGGER trg_pp_updated_at BEFORE UPDATE ON public.payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed 3 providers linked to their clearing accounts
INSERT INTO public.payment_providers (name, provider_code, provider_type, clearing_account_id)
SELECT 'سلة (سلة بايمنتس)', 'salla_payments'::public.sales_payment_provider, 'payment_gateway',
       (SELECT id FROM public.chart_of_accounts WHERE code='1710')
WHERE NOT EXISTS (SELECT 1 FROM public.payment_providers WHERE provider_code='salla_payments');

INSERT INTO public.payment_providers (name, provider_code, provider_type, clearing_account_id)
SELECT 'تابي', 'tabby'::public.sales_payment_provider, 'bnpl',
       (SELECT id FROM public.chart_of_accounts WHERE code='1720')
WHERE NOT EXISTS (SELECT 1 FROM public.payment_providers WHERE provider_code='tabby');

INSERT INTO public.payment_providers (name, provider_code, provider_type, clearing_account_id)
SELECT 'تمارا', 'tamara'::public.sales_payment_provider, 'bnpl',
       (SELECT id FROM public.chart_of_accounts WHERE code='1730')
WHERE NOT EXISTS (SELECT 1 FROM public.payment_providers WHERE provider_code='tamara');

-- 4) payment_settlements
CREATE TABLE IF NOT EXISTS public.payment_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.payment_providers(id) ON DELETE RESTRICT,
  settlement_reference text,
  settlement_date date NOT NULL,
  period_start date,
  period_end date,
  gross_sales_amount numeric(14,2) NOT NULL DEFAULT 0,
  refunds_amount numeric(14,2) NOT NULL DEFAULT 0,
  fees_before_vat numeric(14,2) NOT NULL DEFAULT 0,
  fees_vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  payout_fee numeric(14,2) NOT NULL DEFAULT 0,
  other_deductions numeric(14,2) NOT NULL DEFAULT 0,
  reserve_held numeric(14,2) NOT NULL DEFAULT 0,
  reserve_released numeric(14,2) NOT NULL DEFAULT 0,
  expected_net_amount numeric(14,2) NOT NULL DEFAULT 0,
  actual_bank_amount numeric(14,2),
  difference_amount numeric(14,2) NOT NULL DEFAULT 0,
  status public.payment_settlement_status NOT NULL DEFAULT 'draft',
  bank_income_id uuid REFERENCES public.finance_incomes(id) ON DELETE SET NULL,
  attachment_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, settlement_reference)
);

CREATE INDEX IF NOT EXISTS idx_ps_provider_date ON public.payment_settlements(provider_id, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_ps_status ON public.payment_settlements(status);
CREATE INDEX IF NOT EXISTS idx_ps_bank_income ON public.payment_settlements(bank_income_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settlements TO authenticated;
GRANT ALL ON public.payment_settlements TO service_role;
ALTER TABLE public.payment_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ps_read ON public.payment_settlements;
CREATE POLICY ps_read ON public.payment_settlements FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
DROP POLICY IF EXISTS ps_write ON public.payment_settlements;
CREATE POLICY ps_write ON public.payment_settlements FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

DROP TRIGGER IF EXISTS trg_ps_updated_at ON public.payment_settlements;
CREATE TRIGGER trg_ps_updated_at BEFORE UPDATE ON public.payment_settlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) payment_settlement_lines
CREATE TABLE IF NOT EXISTS public.payment_settlement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.payment_settlements(id) ON DELETE CASCADE,
  line_type public.payment_settlement_line_type NOT NULL,
  external_order_id text,
  sales_invoice_id bigint REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  provider_transaction_id text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  transaction_date date,
  description text,
  raw_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dedup: same provider transaction id cannot appear twice per provider
CREATE UNIQUE INDEX IF NOT EXISTS uniq_psl_provider_txn
  ON public.payment_settlement_lines(settlement_id, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_psl_settlement ON public.payment_settlement_lines(settlement_id);
CREATE INDEX IF NOT EXISTS idx_psl_external_order ON public.payment_settlement_lines(external_order_id);
CREATE INDEX IF NOT EXISTS idx_psl_sales_invoice ON public.payment_settlement_lines(sales_invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settlement_lines TO authenticated;
GRANT ALL ON public.payment_settlement_lines TO service_role;
ALTER TABLE public.payment_settlement_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS psl_read ON public.payment_settlement_lines;
CREATE POLICY psl_read ON public.payment_settlement_lines FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
DROP POLICY IF EXISTS psl_write ON public.payment_settlement_lines;
CREATE POLICY psl_write ON public.payment_settlement_lines FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

-- 6) Auto-compute expected_net_amount and difference_amount via trigger
CREATE OR REPLACE FUNCTION public.compute_settlement_totals()
RETURNS TRIGGER
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
    - COALESCE(NEW.reserve_held,0)
    + COALESCE(NEW.reserve_released,0);
  IF NEW.actual_bank_amount IS NOT NULL THEN
    NEW.difference_amount := NEW.actual_bank_amount - NEW.expected_net_amount;
  ELSE
    NEW.difference_amount := 0;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.compute_settlement_totals() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ps_compute ON public.payment_settlements;
CREATE TRIGGER trg_ps_compute
  BEFORE INSERT OR UPDATE ON public.payment_settlements
  FOR EACH ROW EXECUTE FUNCTION public.compute_settlement_totals();

-- 7) Guard: a bank income can only be linked to ONE settlement at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ps_bank_income
  ON public.payment_settlements(bank_income_id)
  WHERE bank_income_id IS NOT NULL;
