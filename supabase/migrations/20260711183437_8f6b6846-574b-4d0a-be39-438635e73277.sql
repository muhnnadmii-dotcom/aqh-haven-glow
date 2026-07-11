
-- =============================================================
-- Finance system fixes discovered during end-to-end test:
--  (A) Auto-post triggers only fired on INSERT — collections/payments
--      that were classified/linked later never produced a journal
--      entry. Fire on INSERT OR UPDATE (dedup guard already exists).
--  (B) Owner-vs-company detection used only finance_accounts.account_id
--      but most UIs still set only the legacy account_type. Fall back
--      to account_type ('personal' -> owner, 'business' -> company)
--      when account_id is null.
--  (C) journal_entries_guard had no DELETE branch — posted entries
--      could theoretically be hard-deleted. Block it.
-- No column renames, no data changes. All logic remains transaction-safe.
-- =============================================================

CREATE OR REPLACE FUNCTION public.auto_post_finance_income()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_je uuid;
  v_acc_owner_type public.finance_account_owner_type;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT public.acct_should_post(NEW.income_date) THEN RETURN NEW; END IF;

  -- Idempotency: never repost. Covers re-approval, reruns on UPDATE, retries.
  IF EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE source_id = NEW.id::text
      AND source_type IN ('sales_invoice_collection','owner_contribution','owner_reimbursement','internal_transfer')
      AND status <> 'reversed'
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve owner-vs-company: prefer finance_accounts, fall back to account_type.
  IF NEW.account_id IS NOT NULL THEN
    SELECT account_owner_type INTO v_acc_owner_type
      FROM public.finance_accounts WHERE id = NEW.account_id;
  END IF;
  IF v_acc_owner_type IS NULL THEN
    v_acc_owner_type := CASE WHEN NEW.account_type = 'personal'
                             THEN 'owner'::public.finance_account_owner_type
                             ELSE 'company'::public.finance_account_owner_type END;
  END IF;

  IF NEW.transaction_type = 'customer_invoice_collection' AND NEW.sales_invoice_id IS NOT NULL THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (NEW.income_date, 'تحصيل فاتورة مبيعات', 'sales_invoice_collection', NEW.id::text, 'draft')
    RETURNING id INTO v_je;
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, finance_account_id, line_order)
    VALUES
      (v_je,
       public.acct_id(CASE WHEN v_acc_owner_type='owner' THEN 'due_from_owner' ELSE 'cash_bank' END),
       'تحصيل', NEW.amount, 0, NEW.customer_id, NEW.account_id, 1),
      (v_je, public.acct_id('accounts_receivable'), 'إغلاق ذمة', 0, NEW.amount, NEW.customer_id, NULL, 2);

  ELSIF NEW.business_relation = 'owner_settlement' AND v_acc_owner_type='company' THEN
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
    RETURN NEW;
  END IF;

  UPDATE public.journal_entries SET status='posted' WHERE id = v_je;
  RETURN NEW;
END $function$;


CREATE OR REPLACE FUNCTION public.auto_post_finance_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_je uuid;
  v_acc_owner_type public.finance_account_owner_type;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT public.acct_should_post(NEW.expense_date) THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE source_id = NEW.id::text
      AND source_type IN ('purchase_invoice_payment','owner_withdrawal','internal_transfer')
      AND status <> 'reversed'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.account_id IS NOT NULL THEN
    SELECT account_owner_type INTO v_acc_owner_type
      FROM public.finance_accounts WHERE id = NEW.account_id;
  END IF;
  IF v_acc_owner_type IS NULL THEN
    v_acc_owner_type := CASE WHEN NEW.account_type = 'personal'
                             THEN 'owner'::public.finance_account_owner_type
                             ELSE 'company'::public.finance_account_owner_type END;
  END IF;

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
END $function$;


-- (A) Also fire on UPDATE so post-hoc classification/linking creates the JE.
DROP TRIGGER IF EXISTS trg_auto_post_finance_income ON public.finance_incomes;
CREATE TRIGGER trg_auto_post_finance_income
  AFTER INSERT OR UPDATE ON public.finance_incomes
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_finance_income();

DROP TRIGGER IF EXISTS trg_auto_post_finance_expense ON public.finance_expenses;
CREATE TRIGGER trg_auto_post_finance_expense
  AFTER INSERT OR UPDATE ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_finance_expense();


-- (C) Block deletion of posted or reversed journal entries.
CREATE OR REPLACE FUNCTION public.journal_entries_delete_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IN ('posted','reversed') THEN
    RAISE EXCEPTION 'لا يمكن حذف قيد مرحّل أو معكوس (%). استخدم عكس القيد.', OLD.entry_number;
  END IF;
  RETURN OLD;
END $function$;

DROP TRIGGER IF EXISTS trg_je_delete_guard ON public.journal_entries;
CREATE TRIGGER trg_je_delete_guard
  BEFORE DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.journal_entries_delete_guard();
