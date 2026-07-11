
-- =====================================================================
-- 1) ENUMS
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE public.coa_account_type AS ENUM ('asset','liability','equity','revenue','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.journal_entry_status AS ENUM ('draft','posted','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.accounting_period_status AS ENUM ('open','under_review','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.journal_source_type AS ENUM (
    'manual',
    'sales_invoice_approval',
    'sales_invoice_collection',
    'owner_reimbursement',
    'purchase_invoice_approval',
    'purchase_invoice_payment',
    'owner_contribution',
    'owner_withdrawal',
    'internal_transfer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 2) CHART OF ACCOUNTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  account_type public.coa_account_type NOT NULL,
  account_subtype text,
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  allow_manual_entries boolean NOT NULL DEFAULT true,
  system_key text UNIQUE,  -- stable identifier for auto-posting lookups
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coa_type ON public.chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON public.chart_of_accounts(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coa_read" ON public.chart_of_accounts FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "coa_insert" ON public.chart_of_accounts FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE POLICY "coa_update" ON public.chart_of_accounts FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE POLICY "coa_delete" ON public.chart_of_accounts FOR DELETE TO authenticated
  USING ((private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) AND is_system = false);

CREATE OR REPLACE FUNCTION public.coa_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND OLD.is_system THEN
    NEW.code := OLD.code;
    NEW.account_type := OLD.account_type;
    NEW.system_key := OLD.system_key;
    NEW.is_system := true;
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_coa_guard ON public.chart_of_accounts;
CREATE TRIGGER trg_coa_guard BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.coa_guard();

DROP TRIGGER IF EXISTS trg_coa_updated ON public.chart_of_accounts;
CREATE TRIGGER trg_coa_updated BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed system accounts (idempotent via ON CONFLICT on code)
INSERT INTO public.chart_of_accounts (code,name_ar,name_en,account_type,account_subtype,is_system,allow_manual_entries,system_key) VALUES
  -- Assets
  ('1100','النقد والبنوك','Cash & Banks','asset','cash_bank',true,false,'cash_bank'),
  ('1200','العملاء','Accounts Receivable','asset','ar',true,false,'accounts_receivable'),
  ('1300','المخزون','Inventory','asset','inventory',true,true,'inventory'),
  ('1400','ضريبة مدخلات قابلة للخصم','Deductible Input VAT','asset','tax_receivable',true,false,'input_vat_deductible'),
  ('1500','ذمم على المالك','Due from Owner','asset','owner_current',true,false,'due_from_owner'),
  ('1600','الأصول الثابتة','Fixed Assets','asset','fixed_asset',true,true,'fixed_assets'),
  -- Liabilities
  ('2100','الموردون','Accounts Payable','liability','ap',true,false,'accounts_payable'),
  ('2200','ضريبة مخرجات مستحقة','Output VAT Payable','liability','tax_payable',true,false,'output_vat_payable'),
  ('2300','صافي ضريبة القيمة المضافة','Net VAT Payable','liability','tax_payable',true,true,'net_vat_payable'),
  ('2400','مستحقات للمالك','Due to Owner','liability','owner_current',true,false,'due_to_owner'),
  ('2500','القروض','Loans','liability','loan',true,true,'loans'),
  -- Equity
  ('3100','رأس مال المالك','Owner Capital','equity','capital',true,true,'owner_capital'),
  ('3200','سحوبات المالك','Owner Drawings','equity','drawings',true,false,'owner_drawings'),
  ('3300','أرباح مبقاة','Retained Earnings','equity','retained',true,true,'retained_earnings'),
  -- Revenue
  ('4100','المبيعات','Sales Revenue','revenue','sales',true,false,'sales_revenue'),
  ('4900','إيرادات أخرى','Other Income','revenue','other',true,true,'other_income'),
  -- Expenses
  ('5100','تكلفة البضاعة المباعة','Cost of Goods Sold','expense','cogs',true,true,'cogs'),
  ('5200','مصروفات تشغيلية','Operating Expenses','expense','opex',true,true,'operating_expense'),
  ('5300','رواتب','Salaries','expense','salaries',true,true,'salaries_expense'),
  ('5400','توصيل','Delivery','expense','delivery',true,true,'delivery_expense'),
  ('5500','رسوم حكومية','Government Fees','expense','gov',true,true,'government_fees'),
  ('5600','اشتراكات وبرامج','Subscriptions & Software','expense','subscriptions',true,true,'subscriptions_expense'),
  ('5700','ضريبة غير قابلة للخصم','Non-deductible VAT','expense','tax_nd',true,false,'non_deductible_vat_expense'),
  ('5900','مصروفات أخرى','Other Expenses','expense','other',true,true,'other_expense')
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- 3) ACCOUNTING PERIODS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  label text NOT NULL,
  status public.accounting_period_status NOT NULL DEFAULT 'open',
  closed_by uuid REFERENCES auth.users(id),
  closed_at timestamptz,
  reopen_reason text,
  reopened_by uuid REFERENCES auth.users(id),
  reopened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_periods_range CHECK (end_date >= start_date),
  CONSTRAINT accounting_periods_unique_range UNIQUE (start_date, end_date)
);
CREATE INDEX IF NOT EXISTS idx_periods_dates ON public.accounting_periods(start_date, end_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_periods TO authenticated;
GRANT ALL ON public.accounting_periods TO service_role;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periods_read" ON public.accounting_periods FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "periods_write" ON public.accounting_periods FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

DROP TRIGGER IF EXISTS trg_periods_updated ON public.accounting_periods;
CREATE TRIGGER trg_periods_updated BEFORE UPDATE ON public.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: get or create monthly period for a date
CREATE OR REPLACE FUNCTION public.ensure_accounting_period(p_date date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_start date := date_trunc('month', p_date)::date;
  v_end date := (date_trunc('month', p_date) + interval '1 month - 1 day')::date;
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.accounting_periods
    WHERE start_date = v_start AND end_date = v_end;
  IF v_id IS NULL THEN
    INSERT INTO public.accounting_periods(start_date, end_date, label, status)
    VALUES (v_start, v_end, to_char(v_start,'YYYY-MM'), 'open')
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $fn$;

-- =====================================================================
-- 4) ACCOUNTING SETTINGS (single-row)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.accounting_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  accounting_start_date date,
  auto_post_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.accounting_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.accounting_settings TO authenticated;
GRANT ALL ON public.accounting_settings TO service_role;
ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acct_settings_read" ON public.accounting_settings FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "acct_settings_write" ON public.accounting_settings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

DROP TRIGGER IF EXISTS trg_acct_settings_updated ON public.accounting_settings;
CREATE TRIGGER trg_acct_settings_updated BEFORE UPDATE ON public.accounting_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- 5) JOURNAL ENTRIES
-- =====================================================================
CREATE SEQUENCE IF NOT EXISTS public.journal_entries_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE,
  entry_date date NOT NULL,
  source_type public.journal_source_type NOT NULL DEFAULT 'manual',
  source_id text,  -- polymorphic: text so it can hold bigint or uuid
  description text,
  status public.journal_entry_status NOT NULL DEFAULT 'draft',
  period_id uuid REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
  reversal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  reversed_by_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  total_debit numeric(14,2) NOT NULL DEFAULT 0,
  total_credit numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  posted_by uuid REFERENCES auth.users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_je_date ON public.journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_je_status ON public.journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_je_source ON public.journal_entries(source_type, source_id);
-- Prevent duplicate automated entry per source (excluding manual)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_je_source_active
  ON public.journal_entries(source_type, source_id)
  WHERE source_type <> 'manual' AND source_id IS NOT NULL AND status <> 'reversed';

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  description text,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  finance_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  owner_settlement_reference text,
  line_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jel_amounts_nonneg CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT jel_not_both CHECK ((debit = 0) OR (credit = 0)),
  CONSTRAINT jel_at_least_one CHECK (debit > 0 OR credit > 0)
);
CREATE INDEX IF NOT EXISTS idx_jel_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON public.journal_entry_lines(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_lines TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
GRANT ALL ON public.journal_entry_lines TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.journal_entries_number_seq TO authenticated, service_role;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "je_read" ON public.journal_entries FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "je_insert" ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));
CREATE POLICY "je_update" ON public.journal_entries FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));
CREATE POLICY "je_delete_draft" ON public.journal_entries FOR DELETE TO authenticated
  USING ((private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) AND status = 'draft');

CREATE POLICY "jel_read" ON public.journal_entry_lines FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "jel_write" ON public.journal_entry_lines FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));

DROP TRIGGER IF EXISTS trg_je_updated ON public.journal_entries;
CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Number generator
CREATE OR REPLACE FUNCTION public.next_journal_entry_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_year text := to_char(now(),'YYYY');
  v_num bigint;
  v_candidate text;
BEGIN
  LOOP
    v_num := nextval('public.journal_entries_number_seq');
    v_candidate := 'JE-' || v_year || '-' || lpad(v_num::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE entry_number = v_candidate);
  END LOOP;
  RETURN v_candidate;
END $fn$;

-- BEFORE INSERT: assign number + period
CREATE OR REPLACE FUNCTION public.journal_entries_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  IF NEW.entry_number IS NULL OR NEW.entry_number = '' THEN
    NEW.entry_number := public.next_journal_entry_number();
  END IF;
  IF NEW.period_id IS NULL THEN
    NEW.period_id := public.ensure_accounting_period(NEW.entry_date);
  END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_je_before_insert ON public.journal_entries;
CREATE TRIGGER trg_je_before_insert BEFORE INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.journal_entries_before_insert();

-- Guard: prevent editing posted entries (except reversal linking)
CREATE OR REPLACE FUNCTION public.journal_entries_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_period_status public.accounting_period_status;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- posted entries frozen (except status transitions and reversed_by link)
    IF OLD.status = 'posted' THEN
      NEW.entry_date := OLD.entry_date;
      NEW.source_type := OLD.source_type;
      NEW.source_id := OLD.source_id;
      NEW.period_id := OLD.period_id;
      NEW.entry_number := OLD.entry_number;
    END IF;
    IF OLD.status = 'reversed' THEN
      RAISE EXCEPTION 'لا يمكن تعديل قيد معكوس';
    END IF;
  END IF;
  -- Prevent posting into closed period
  IF NEW.status = 'posted' AND (TG_OP='INSERT' OR OLD.status <> 'posted') THEN
    SELECT status INTO v_period_status FROM public.accounting_periods WHERE id = NEW.period_id;
    IF v_period_status = 'closed' THEN
      RAISE EXCEPTION 'الفترة المحاسبية مغلقة، لا يمكن الترحيل داخلها';
    END IF;
    NEW.posted_by := COALESCE(NEW.posted_by, auth.uid());
    NEW.posted_at := COALESCE(NEW.posted_at, now());
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_je_guard ON public.journal_entries;
CREATE TRIGGER trg_je_guard BEFORE UPDATE OR INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.journal_entries_guard();

-- Lines guard: block edits when parent posted
CREATE OR REPLACE FUNCTION public.journal_lines_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_status public.journal_entry_status;
  v_je uuid;
BEGIN
  v_je := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  SELECT status INTO v_status FROM public.journal_entries WHERE id = v_je;
  IF v_status IN ('posted','reversed') THEN
    RAISE EXCEPTION 'لا يمكن تعديل بنود قيد مرحّل أو معكوس';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $fn$;
DROP TRIGGER IF EXISTS trg_jel_guard ON public.journal_entry_lines;
CREATE TRIGGER trg_jel_guard BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION public.journal_lines_guard();

-- Recalc totals on lines change
CREATE OR REPLACE FUNCTION public.journal_lines_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_je uuid;
BEGIN
  v_je := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  UPDATE public.journal_entries SET
    total_debit = COALESCE((SELECT SUM(debit) FROM public.journal_entry_lines WHERE journal_entry_id = v_je),0),
    total_credit = COALESCE((SELECT SUM(credit) FROM public.journal_entry_lines WHERE journal_entry_id = v_je),0)
  WHERE id = v_je;
  RETURN COALESCE(NEW, OLD);
END $fn$;
DROP TRIGGER IF EXISTS trg_jel_recalc ON public.journal_entry_lines;
CREATE TRIGGER trg_jel_recalc AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION public.journal_lines_recalc();

-- Balance check: DEFERRED constraint trigger — runs at COMMIT
CREATE OR REPLACE FUNCTION public.journal_entries_check_balance()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_status public.journal_entry_status;
BEGIN
  SELECT status, total_debit, total_credit INTO v_status, v_debit, v_credit
    FROM public.journal_entries WHERE id = NEW.id;
  IF v_status IS NULL THEN RETURN NEW; END IF;  -- deleted
  IF v_status = 'posted' THEN
    IF v_debit IS DISTINCT FROM v_credit OR v_debit = 0 THEN
      RAISE EXCEPTION 'قيد غير متوازن: مدين=% دائن=% (قيد %)', v_debit, v_credit, NEW.entry_number;
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_je_balance ON public.journal_entries;
CREATE CONSTRAINT TRIGGER trg_je_balance
  AFTER INSERT OR UPDATE ON public.journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.journal_entries_check_balance();

-- =====================================================================
-- 6) HELPER: post a balanced entry from JSON payload (RPC)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.post_journal_entry(
  p_entry_date date,
  p_description text,
  p_source_type public.journal_source_type,
  p_source_id text,
  p_lines jsonb  -- [{account_code, debit, credit, description, customer_id, supplier_id, finance_account_id}]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, private AS $fn$
DECLARE
  v_start_date date;
  v_je_id uuid;
  v_line jsonb;
  v_acc_id uuid;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
       OR private.has_role(auth.uid(),'finance_manage')
       OR private.has_role(auth.uid(),'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT accounting_start_date INTO v_start_date FROM public.accounting_settings WHERE id = 1;
  IF v_start_date IS NOT NULL AND p_entry_date < v_start_date THEN
    RAISE EXCEPTION 'التاريخ قبل بداية المحاسبة (%)', v_start_date;
  END IF;

  INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
  VALUES (p_entry_date, p_description, p_source_type, p_source_id, 'draft')
  RETURNING id INTO v_je_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT id INTO v_acc_id FROM public.chart_of_accounts
      WHERE code = v_line->>'account_code' AND is_active = true;
    IF v_acc_id IS NULL THEN
      RAISE EXCEPTION 'حساب غير موجود: %', v_line->>'account_code';
    END IF;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, supplier_id, finance_account_id)
    VALUES (
      v_je_id, v_acc_id, v_line->>'description',
      COALESCE((v_line->>'debit')::numeric, 0),
      COALESCE((v_line->>'credit')::numeric, 0),
      NULLIF(v_line->>'customer_id','')::uuid,
      NULLIF(v_line->>'supplier_id','')::uuid,
      NULLIF(v_line->>'finance_account_id','')::uuid
    );
  END LOOP;

  UPDATE public.journal_entries SET status = 'posted' WHERE id = v_je_id;
  RETURN v_je_id;
END $fn$;

-- Reversal
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_entry_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, private AS $fn$
DECLARE
  v_orig public.journal_entries%ROWTYPE;
  v_new_id uuid;
  v_line record;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
       OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO v_orig FROM public.journal_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'قيد غير موجود'; END IF;
  IF v_orig.status <> 'posted' THEN RAISE EXCEPTION 'يمكن عكس القيود المرحّلة فقط'; END IF;

  INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status, reversal_entry_id)
  VALUES (CURRENT_DATE, 'قيد عكسي: ' || COALESCE(v_orig.description,'') || ' — ' || COALESCE(p_reason,''),
          'manual', v_orig.entry_number, 'draft', v_orig.id)
  RETURNING id INTO v_new_id;

  FOR v_line IN SELECT * FROM public.journal_entry_lines WHERE journal_entry_id = p_entry_id ORDER BY line_order LOOP
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, supplier_id, finance_account_id, line_order)
    VALUES (v_new_id, v_line.account_id, v_line.description, v_line.credit, v_line.debit,
            v_line.customer_id, v_line.supplier_id, v_line.finance_account_id, v_line.line_order);
  END LOOP;

  UPDATE public.journal_entries SET status='posted' WHERE id = v_new_id;
  UPDATE public.journal_entries SET status='reversed', reversed_by_entry_id = v_new_id WHERE id = p_entry_id;
  RETURN v_new_id;
END $fn$;

-- =====================================================================
-- 7) AUTO-POSTING HELPERS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.acct_should_post(p_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
  SELECT COALESCE(auto_post_enabled, false) AND (accounting_start_date IS NULL OR p_date >= accounting_start_date)
    FROM public.accounting_settings WHERE id = 1;
$fn$;

CREATE OR REPLACE FUNCTION public.acct_id(p_key text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
  SELECT id FROM public.chart_of_accounts WHERE system_key = p_key;
$fn$;

-- --- Sales invoice approval ---
CREATE OR REPLACE FUNCTION public.auto_post_sales_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_je uuid;
BEGIN
  IF NOT (NEW.status IN ('approved','partially_paid','paid')
          AND (TG_OP='INSERT' OR OLD.status NOT IN ('approved','partially_paid','paid'))) THEN
    RETURN NEW;
  END IF;
  IF NOT public.acct_should_post(NEW.issue_date) THEN RETURN NEW; END IF;
  -- skip duplicate
  IF EXISTS (SELECT 1 FROM public.journal_entries
             WHERE source_type='sales_invoice_approval' AND source_id = NEW.id::text AND status <> 'reversed') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
  VALUES (NEW.issue_date, 'اعتماد فاتورة مبيعات ' || NEW.invoice_number, 'sales_invoice_approval', NEW.id::text, 'draft')
  RETURNING id INTO v_je;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
  VALUES
    (v_je, public.acct_id('accounts_receivable'), 'ذمة عميل - ' || NEW.invoice_number, NEW.total_amount, 0, NEW.customer_id, 1),
    (v_je, public.acct_id('sales_revenue'), 'مبيعات - ' || NEW.invoice_number, 0, NEW.taxable_amount, NEW.customer_id, 2);
  IF NEW.vat_amount > 0 THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
    VALUES (v_je, public.acct_id('output_vat_payable'), 'ضريبة مخرجات - ' || NEW.invoice_number, 0, NEW.vat_amount, 3);
  END IF;

  UPDATE public.journal_entries SET status='posted' WHERE id = v_je;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_auto_post_sales_invoice ON public.sales_invoices;
CREATE TRIGGER trg_auto_post_sales_invoice AFTER INSERT OR UPDATE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_sales_invoice();

-- --- Purchase invoice approval ---
CREATE OR REPLACE FUNCTION public.auto_post_purchase_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_je uuid;
  v_expense_key text;
  v_net numeric(14,2);
BEGIN
  IF NOT (NEW.status IN ('approved','partially_paid','paid')
          AND (TG_OP='INSERT' OR OLD.status NOT IN ('approved','partially_paid','paid'))) THEN
    RETURN NEW;
  END IF;
  IF NOT public.acct_should_post(NEW.issue_date) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries
             WHERE source_type='purchase_invoice_approval' AND source_id = NEW.id::text AND status <> 'reversed') THEN
    RETURN NEW;
  END IF;

  v_expense_key := CASE NEW.purchase_type
    WHEN 'inventory' THEN 'inventory'
    WHEN 'asset' THEN 'fixed_assets'
    WHEN 'government_fee' THEN 'government_fees'
    ELSE 'operating_expense'
  END;
  v_net := NEW.taxable_amount;

  INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
  VALUES (NEW.issue_date, 'اعتماد فاتورة مشتريات ' || NEW.internal_reference, 'purchase_invoice_approval', NEW.id::text, 'draft')
  RETURNING id INTO v_je;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, line_order)
  VALUES (v_je, public.acct_id(v_expense_key), 'مصروف/أصل - ' || NEW.internal_reference, v_net, 0, NEW.supplier_id, 1);
  IF NEW.deductible_vat_amount > 0 THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
    VALUES (v_je, public.acct_id('input_vat_deductible'), 'ضريبة مدخلات قابلة للخصم', NEW.deductible_vat_amount, 0, 2);
  END IF;
  IF NEW.non_deductible_vat_amount > 0 THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
    VALUES (v_je, public.acct_id('non_deductible_vat_expense'), 'ضريبة غير قابلة للخصم', NEW.non_deductible_vat_amount, 0, 3);
  END IF;
  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, line_order)
  VALUES (v_je, public.acct_id('accounts_payable'), 'ذمة مورد - ' || NEW.internal_reference, 0, NEW.total_amount, NEW.supplier_id, 4);

  UPDATE public.journal_entries SET status='posted' WHERE id = v_je;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_auto_post_purchase_invoice ON public.purchase_invoices;
CREATE TRIGGER trg_auto_post_purchase_invoice AFTER INSERT OR UPDATE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_purchase_invoice();

-- --- Finance income (collections / owner contribution / transfers) ---
CREATE OR REPLACE FUNCTION public.auto_post_finance_income()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_je uuid;
  v_acc_owner_type public.finance_account_owner_type;
  v_debit_key text;
  v_credit_key text;
  v_customer uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT public.acct_should_post(NEW.income_date) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries
             WHERE source_id = NEW.id::text
               AND source_type IN ('sales_invoice_collection','owner_contribution','owner_reimbursement','internal_transfer')
               AND status <> 'reversed') THEN
    RETURN NEW;
  END IF;

  SELECT account_owner_type INTO v_acc_owner_type FROM public.finance_accounts WHERE id = NEW.account_id;

  -- Decide entry pattern based on business_relation + transaction_type
  IF NEW.transaction_type = 'customer_invoice_collection' AND NEW.sales_invoice_id IS NOT NULL THEN
    -- Collection of AR
    IF v_acc_owner_type = 'owner' THEN
      v_debit_key := 'due_from_owner';
    ELSE
      v_debit_key := 'cash_bank';
    END IF;
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.income_date, 'تحصيل فاتورة مبيعات', 'sales_invoice_collection', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, finance_account_id, line_order)
    VALUES
      (v_je, public.acct_id(v_debit_key), 'تحصيل', NEW.amount, 0, NEW.customer_id, NEW.account_id, 1),
      (v_je, public.acct_id('accounts_receivable'), 'إغلاق ذمة', 0, NEW.amount, NEW.customer_id, NULL, 2);

  ELSIF NEW.business_relation = 'owner_settlement' AND v_acc_owner_type='company' THEN
    -- Owner reimbursement to company (owner paying company)
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.income_date, 'تحويل تحصيل من الشخصي للتجاري', 'owner_reimbursement', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
    VALUES
      (v_je, public.acct_id('cash_bank'), 'استلام تجاري', NEW.amount, 0, NEW.account_id, 1),
      (v_je, public.acct_id('due_from_owner'), 'إغلاق ذمم المالك', 0, NEW.amount, NULL, 2);

  ELSIF NEW.transaction_type = 'owner_contribution' THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.income_date, 'مساهمة مالك', 'owner_contribution', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
    VALUES
      (v_je, public.acct_id('cash_bank'), 'استلام مساهمة', NEW.amount, 0, NEW.account_id, 1),
      (v_je, public.acct_id('owner_capital'), 'زيادة رأس المال', 0, NEW.amount, NULL, 2);

  ELSIF NEW.transaction_type = 'internal_transfer_in' THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.income_date, 'تحويل داخلي - وارد', 'internal_transfer', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
    VALUES
      (v_je, public.acct_id('cash_bank'), 'حساب مستلم', NEW.amount, 0, NEW.account_id, 1),
      (v_je, public.acct_id('cash_bank'), 'حساب مصدر (يعادل بقيد صادر)', 0, NEW.amount, NULL, 2);
  ELSE
    RETURN NEW; -- unclassified: skip
  END IF;

  UPDATE public.journal_entries SET status='posted' WHERE id = v_je;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_auto_post_finance_income ON public.finance_incomes;
CREATE TRIGGER trg_auto_post_finance_income AFTER INSERT ON public.finance_incomes
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_finance_income();

-- --- Finance expense (supplier payments / owner withdrawal / transfers) ---
CREATE OR REPLACE FUNCTION public.auto_post_finance_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_je uuid;
  v_acc_owner_type public.finance_account_owner_type;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT public.acct_should_post(NEW.expense_date) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries
             WHERE source_id = NEW.id::text
               AND source_type IN ('purchase_invoice_payment','owner_withdrawal','internal_transfer')
               AND status <> 'reversed') THEN
    RETURN NEW;
  END IF;

  SELECT account_owner_type INTO v_acc_owner_type FROM public.finance_accounts WHERE id = NEW.account_id;

  IF NEW.purchase_invoice_id IS NOT NULL OR NEW.transaction_type = 'supplier_invoice_payment' THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.expense_date, 'دفع مورد', 'purchase_invoice_payment', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, finance_account_id, line_order)
    VALUES (v_je, public.acct_id('accounts_payable'), 'إغلاق ذمة مورد', NEW.amount, 0, NEW.supplier_id, NULL, 1);
    IF v_acc_owner_type='owner' THEN
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
      VALUES (v_je, public.acct_id('due_to_owner'), 'استحقاق للمالك', 0, NEW.amount, NEW.account_id, 2);
    ELSE
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
      VALUES (v_je, public.acct_id('cash_bank'), 'دفع من البنك', 0, NEW.amount, NEW.account_id, 2);
    END IF;

  ELSIF NEW.business_relation = 'owner_settlement' AND v_acc_owner_type='company' THEN
    -- Company reimbursing owner
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.expense_date, 'تعويض المالك', 'owner_withdrawal', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
    VALUES
      (v_je, public.acct_id('due_to_owner'), 'إغلاق مستحقات المالك', NEW.amount, 0, NULL, 1),
      (v_je, public.acct_id('cash_bank'), 'دفع تجاري', 0, NEW.amount, NEW.account_id, 2);

  ELSIF NEW.transaction_type = 'owner_withdrawal' THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.expense_date, 'سحب مالك', 'owner_withdrawal', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
    VALUES
      (v_je, public.acct_id('owner_drawings'), 'سحوبات المالك', NEW.amount, 0, NULL, 1),
      (v_je, public.acct_id('cash_bank'), 'دفع من البنك', 0, NEW.amount, NEW.account_id, 2);

  ELSIF NEW.transaction_type = 'internal_transfer_out' THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.expense_date, 'تحويل داخلي - صادر', 'internal_transfer', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
    VALUES
      (v_je, public.acct_id('cash_bank'), 'حساب مستلم (يعادل بقيد وارد)', NEW.amount, 0, NULL, 1),
      (v_je, public.acct_id('cash_bank'), 'حساب مصدر', 0, NEW.amount, NEW.account_id, 2);
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.journal_entries SET status='posted' WHERE id = v_je;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_auto_post_finance_expense ON public.finance_expenses;
CREATE TRIGGER trg_auto_post_finance_expense AFTER INSERT ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_finance_expense();

-- =====================================================================
-- 8) TRIAL BALANCE + GENERAL LEDGER RPCs
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_trial_balance(p_from date, p_to date)
RETURNS TABLE(
  account_id uuid, code text, name_ar text, account_type public.coa_account_type,
  total_debit numeric, total_credit numeric, balance numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, private AS $fn$
  SELECT a.id, a.code, a.name_ar, a.account_type,
         COALESCE(SUM(l.debit),0), COALESCE(SUM(l.credit),0),
         COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0)
    FROM public.chart_of_accounts a
    LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries e ON e.id = l.journal_entry_id
      AND e.status='posted' AND e.entry_date BETWEEN p_from AND p_to
   WHERE private.has_any_finance_role(auth.uid())
   GROUP BY a.id, a.code, a.name_ar, a.account_type
   ORDER BY a.code;
$fn$;

CREATE OR REPLACE FUNCTION public.get_general_ledger(p_account_id uuid, p_from date, p_to date)
RETURNS TABLE(
  entry_id uuid, entry_number text, entry_date date, description text,
  debit numeric, credit numeric, running_balance numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, private AS $fn$
  SELECT e.id, e.entry_number, e.entry_date, COALESCE(l.description, e.description),
         l.debit, l.credit,
         SUM(l.debit - l.credit) OVER (ORDER BY e.entry_date, e.entry_number, l.line_order
                                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    FROM public.journal_entry_lines l
    JOIN public.journal_entries e ON e.id = l.journal_entry_id
   WHERE l.account_id = p_account_id
     AND e.status = 'posted'
     AND e.entry_date BETWEEN p_from AND p_to
     AND private.has_any_finance_role(auth.uid())
   ORDER BY e.entry_date, e.entry_number, l.line_order;
$fn$;

-- Close/reopen period
CREATE OR REPLACE FUNCTION public.close_accounting_period(p_period_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, private AS $fn$
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.accounting_periods
     SET status='closed', closed_by=auth.uid(), closed_at=now()
   WHERE id = p_period_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.reopen_accounting_period(p_period_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, private AS $fn$
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  IF p_reason IS NULL OR p_reason='' THEN RAISE EXCEPTION 'يجب إدخال سبب إعادة الفتح'; END IF;
  UPDATE public.accounting_periods
     SET status='open', reopen_reason=p_reason, reopened_by=auth.uid(), reopened_at=now(),
         closed_by=NULL, closed_at=NULL
   WHERE id = p_period_id;
END $fn$;

-- Grants for RPCs
GRANT EXECUTE ON FUNCTION public.post_journal_entry(date,text,public.journal_source_type,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_balance(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_general_ledger(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_accounting_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_accounting_period(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_accounting_period(date) TO authenticated;
