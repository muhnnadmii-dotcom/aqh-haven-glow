CREATE OR REPLACE FUNCTION public.auto_post_finance_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_je uuid;
  v_acc_owner_type public.finance_account_owner_type;
  v_pi_total numeric;
  v_pi_ok boolean := false;
  v_pi_approved boolean := false;
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

  IF NEW.purchase_invoice_id IS NOT NULL THEN
    SELECT pi.total_amount,
           (pi.status IS DISTINCT FROM 'rejected' AND pi.deleted_at IS NULL)
      INTO v_pi_total, v_pi_ok
      FROM public.purchase_invoices pi
     WHERE pi.id = NEW.purchase_invoice_id;

    IF NOT COALESCE(v_pi_ok, false) THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.journal_entries je
       WHERE je.source_type = 'purchase_invoice_approval'
         AND je.source_id = NEW.purchase_invoice_id::text
         AND je.status = 'posted'
    ) INTO v_pi_approved;

    IF NOT v_pi_approved THEN
      RETURN NEW;
    END IF;

    IF ABS(COALESCE(NEW.amount,0) - COALESCE(v_pi_total,0)) > 0.05 THEN
      RETURN NEW;
    END IF;

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

  ELSIF NEW.transaction_type = 'supplier_invoice_payment' THEN
    RETURN NEW;

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

COMMENT ON FUNCTION public.auto_post_finance_expense() IS
'Auto-posts journal entries for finance_expenses. Supplier invoice payment requires purchase_invoice_id linked to a non-rejected, non-deleted invoice with a posted approval JE and amount match within 0.05 SAR. The enum purchase_invoice_status has no ''cancelled'' value; ''rejected'' is the semantic equivalent for a voided invoice.';