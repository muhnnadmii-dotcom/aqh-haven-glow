
-- Enums
DO $$ BEGIN
  CREATE TYPE public.finance_transaction_direction AS ENUM ('incoming','outgoing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_incoming_type AS ENUM (
    'customer_invoice_collection','cash_sale','owner_contribution',
    'internal_transfer_in','supplier_refund','loan_received',
    'other_income','unclassified_incoming'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_outgoing_type AS ENUM (
    'supplier_invoice_payment','operating_expense','inventory_purchase',
    'asset_purchase','owner_withdrawal','internal_transfer_out',
    'loan_payment','tax_or_government_payment','customer_refund',
    'unclassified_outgoing'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_accounting_status AS ENUM ('unclassified','classified','reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- finance_incomes
ALTER TABLE public.finance_incomes
  ADD COLUMN IF NOT EXISTS transaction_direction public.finance_transaction_direction NOT NULL DEFAULT 'incoming',
  ADD COLUMN IF NOT EXISTS transaction_type public.finance_incoming_type,
  ADD COLUMN IF NOT EXISTS accounting_status public.finance_accounting_status NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS related_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS internal_note text;

-- finance_expenses
ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS transaction_direction public.finance_transaction_direction NOT NULL DEFAULT 'outgoing',
  ADD COLUMN IF NOT EXISTS transaction_type public.finance_outgoing_type,
  ADD COLUMN IF NOT EXISTS accounting_status public.finance_accounting_status NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS related_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS internal_note text;

CREATE INDEX IF NOT EXISTS idx_finance_incomes_txn_type ON public.finance_incomes(transaction_type);
CREATE INDEX IF NOT EXISTS idx_finance_incomes_acc_status ON public.finance_incomes(accounting_status);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_txn_type ON public.finance_expenses(transaction_type);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_acc_status ON public.finance_expenses(accounting_status);
