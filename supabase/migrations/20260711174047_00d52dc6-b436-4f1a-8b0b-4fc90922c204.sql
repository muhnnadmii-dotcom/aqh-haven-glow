
-- Phase 1: Finance accounts registry + business_relation classifier + Owner Current Account function

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.finance_account_owner_type AS ENUM ('company','owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_account_kind AS ENUM ('bank','cash','wallet','payment_gateway','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_business_relation AS ENUM ('business','personal','owner_settlement','internal_transfer','unclassified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) finance_accounts table
CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  account_owner_type public.finance_account_owner_type NOT NULL DEFAULT 'company',
  account_kind public.finance_account_kind NOT NULL DEFAULT 'bank',
  include_in_company_cash_balance boolean NOT NULL DEFAULT true,
  allow_business_transactions boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounts TO authenticated;
GRANT ALL ON public.finance_accounts TO service_role;

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_accounts_read ON public.finance_accounts;
CREATE POLICY fin_accounts_read ON public.finance_accounts
  FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));

DROP POLICY IF EXISTS fin_accounts_write ON public.finance_accounts;
CREATE POLICY fin_accounts_write ON public.finance_accounts
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

DROP TRIGGER IF EXISTS trg_finance_accounts_updated_at ON public.finance_accounts;
CREATE TRIGGER trg_finance_accounts_updated_at
  BEFORE UPDATE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Classifier + account link columns (nullable, non-destructive)
ALTER TABLE public.finance_incomes
  ADD COLUMN IF NOT EXISTS business_relation public.finance_business_relation NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS sales_invoice_id bigint REFERENCES public.aqh_quotes(id) ON DELETE SET NULL;

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS business_relation public.finance_business_relation NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_incomes_account ON public.finance_incomes(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_incomes_business_relation ON public.finance_incomes(business_relation);
CREATE INDEX IF NOT EXISTS idx_finance_incomes_sales_invoice ON public.finance_incomes(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_account ON public.finance_expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_business_relation ON public.finance_expenses(business_relation);

-- Guard the new columns for finance_accountant role (same pattern as other sensitive fields)
-- (Existing trigger already restricts updates broadly; extend it.)
CREATE OR REPLACE FUNCTION public.finance_accountant_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') THEN
    RETURN NEW;
  END IF;
  IF private.has_role(auth.uid(),'finance_accountant') THEN
    IF TG_TABLE_NAME = 'finance_incomes' THEN
      NEW.income_date := OLD.income_date;
      NEW.amount := OLD.amount;
      NEW.account_type := OLD.account_type;
      NEW.income_source_id := OLD.income_source_id;
      NEW.note := OLD.note;
      NEW.attachment_status := OLD.attachment_status;
      NEW.created_by := OLD.created_by;
      NEW.internal_review_status := OLD.internal_review_status;
      NEW.deleted_at := OLD.deleted_at;
      NEW.deleted_by := OLD.deleted_by;
      NEW.delete_reason := OLD.delete_reason;
      NEW.business_relation := OLD.business_relation;
      NEW.account_id := OLD.account_id;
      NEW.customer_id := OLD.customer_id;
      NEW.sales_invoice_id := OLD.sales_invoice_id;
    ELSIF TG_TABLE_NAME = 'finance_expenses' THEN
      NEW.expense_date := OLD.expense_date;
      NEW.amount := OLD.amount;
      NEW.account_type := OLD.account_type;
      NEW.item_name := OLD.item_name;
      NEW.supplier_id := OLD.supplier_id;
      NEW.supplier_name := OLD.supplier_name;
      NEW.note := OLD.note;
      NEW.attachment_status := OLD.attachment_status;
      NEW.created_by := OLD.created_by;
      NEW.internal_review_status := OLD.internal_review_status;
      NEW.deleted_at := OLD.deleted_at;
      NEW.deleted_by := OLD.deleted_by;
      NEW.delete_reason := OLD.delete_reason;
      NEW.business_relation := OLD.business_relation;
      NEW.account_id := OLD.account_id;
    END IF;
  END IF;
  RETURN NEW;
END$function$;

-- 4) Owner Current Account function
CREATE OR REPLACE FUNCTION public.get_owner_current_account()
RETURNS TABLE(
  collected_by_owner numeric,
  paid_by_owner numeric,
  owner_to_company numeric,
  company_to_owner numeric,
  amount_due_from_owner numeric,
  amount_due_to_owner numeric,
  net_owner_balance numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$
  WITH
  collected AS (
    SELECT COALESCE(SUM(i.amount),0) AS v
    FROM public.finance_incomes i
    JOIN public.finance_accounts a ON a.id = i.account_id
    WHERE i.deleted_at IS NULL
      AND a.account_owner_type = 'owner'
      AND i.business_relation = 'business'
  ),
  paid AS (
    SELECT COALESCE(SUM(e.amount),0) AS v
    FROM public.finance_expenses e
    JOIN public.finance_accounts a ON a.id = e.account_id
    WHERE e.deleted_at IS NULL
      AND a.account_owner_type = 'owner'
      AND e.business_relation = 'business'
  ),
  owner_to_co AS (
    SELECT COALESCE(SUM(i.amount),0) AS v
    FROM public.finance_incomes i
    JOIN public.finance_accounts a ON a.id = i.account_id
    WHERE i.deleted_at IS NULL
      AND a.account_owner_type = 'company'
      AND i.business_relation = 'owner_settlement'
  ),
  co_to_owner AS (
    SELECT COALESCE(SUM(e.amount),0) AS v
    FROM public.finance_expenses e
    JOIN public.finance_accounts a ON a.id = e.account_id
    WHERE e.deleted_at IS NULL
      AND a.account_owner_type = 'company'
      AND e.business_relation = 'owner_settlement'
  )
  SELECT
    (SELECT v FROM collected)                                      AS collected_by_owner,
    (SELECT v FROM paid)                                           AS paid_by_owner,
    (SELECT v FROM owner_to_co)                                    AS owner_to_company,
    (SELECT v FROM co_to_owner)                                    AS company_to_owner,
    GREATEST(0, ((SELECT v FROM collected) - (SELECT v FROM owner_to_co)) - ((SELECT v FROM paid) - (SELECT v FROM co_to_owner))) AS amount_due_from_owner,
    GREATEST(0, ((SELECT v FROM paid) - (SELECT v FROM co_to_owner)) - ((SELECT v FROM collected) - (SELECT v FROM owner_to_co))) AS amount_due_to_owner,
    ((SELECT v FROM collected) - (SELECT v FROM owner_to_co)) - ((SELECT v FROM paid) - (SELECT v FROM co_to_owner)) AS net_owner_balance
  WHERE private.has_any_finance_role(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_owner_current_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_current_account() TO authenticated;
