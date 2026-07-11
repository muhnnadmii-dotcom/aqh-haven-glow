
-- New incoming types
ALTER TYPE public.finance_incoming_type ADD VALUE IF NOT EXISTS 'direct_sale';
ALTER TYPE public.finance_incoming_type ADD VALUE IF NOT EXISTS 'customer_advance';
ALTER TYPE public.finance_incoming_type ADD VALUE IF NOT EXISTS 'payment_provider_settlement';
ALTER TYPE public.finance_incoming_type ADD VALUE IF NOT EXISTS 'owner_collection';
ALTER TYPE public.finance_incoming_type ADD VALUE IF NOT EXISTS 'other_incoming';

-- New outgoing types
ALTER TYPE public.finance_outgoing_type ADD VALUE IF NOT EXISTS 'direct_operating_expense';
ALTER TYPE public.finance_outgoing_type ADD VALUE IF NOT EXISTS 'salary_payment';
ALTER TYPE public.finance_outgoing_type ADD VALUE IF NOT EXISTS 'government_fee';
ALTER TYPE public.finance_outgoing_type ADD VALUE IF NOT EXISTS 'owner_reimbursement';
ALTER TYPE public.finance_outgoing_type ADD VALUE IF NOT EXISTS 'other_outgoing';

-- New optional linkage columns on finance_incomes
ALTER TABLE public.finance_incomes
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_provider_id uuid,
  ADD COLUMN IF NOT EXISTS settlement_id uuid;

-- New optional linkage columns on finance_expenses
ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS sales_invoice_id bigint REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_provider_id uuid,
  ADD COLUMN IF NOT EXISTS settlement_id uuid;

-- Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS finance_incomes_supplier_id_idx ON public.finance_incomes(supplier_id);
CREATE INDEX IF NOT EXISTS finance_incomes_payment_provider_id_idx ON public.finance_incomes(payment_provider_id);
CREATE INDEX IF NOT EXISTS finance_incomes_settlement_id_idx ON public.finance_incomes(settlement_id);
CREATE INDEX IF NOT EXISTS finance_expenses_customer_id_idx ON public.finance_expenses(customer_id);
CREATE INDEX IF NOT EXISTS finance_expenses_sales_invoice_id_idx ON public.finance_expenses(sales_invoice_id);
CREATE INDEX IF NOT EXISTS finance_expenses_payment_provider_id_idx ON public.finance_expenses(payment_provider_id);
CREATE INDEX IF NOT EXISTS finance_expenses_settlement_id_idx ON public.finance_expenses(settlement_id);
