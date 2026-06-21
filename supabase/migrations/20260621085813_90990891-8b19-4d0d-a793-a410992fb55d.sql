
ALTER TABLE public.finance_incomes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason text;

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason text;

CREATE INDEX IF NOT EXISTS idx_finance_incomes_deleted_at ON public.finance_incomes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_deleted_at ON public.finance_expenses(deleted_at);

-- Update accountant guard so accountants cannot soft-delete/restore
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
    END IF;
  END IF;
  RETURN NEW;
END$function$;
