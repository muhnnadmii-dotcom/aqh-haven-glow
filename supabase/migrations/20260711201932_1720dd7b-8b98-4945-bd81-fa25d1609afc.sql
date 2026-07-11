
-- Add split parent columns for splitting old transactions into multiple children
ALTER TABLE public.finance_incomes
  ADD COLUMN IF NOT EXISTS split_parent_id uuid NULL REFERENCES public.finance_incomes(id) ON DELETE SET NULL;
ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS split_parent_id uuid NULL REFERENCES public.finance_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_incomes_split_parent ON public.finance_incomes(split_parent_id) WHERE split_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_expenses_split_parent ON public.finance_expenses(split_parent_id) WHERE split_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_incomes_settlement ON public.finance_incomes(settlement_id) WHERE settlement_id IS NOT NULL;
