
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- finance_incomes
CREATE INDEX IF NOT EXISTS idx_fin_inc_active_date ON public.finance_incomes (income_date DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_inc_source ON public.finance_incomes (income_source_id);
CREATE INDEX IF NOT EXISTS idx_fin_inc_attachment_status ON public.finance_incomes (attachment_status);
CREATE INDEX IF NOT EXISTS idx_fin_inc_accountant_status ON public.finance_incomes (accountant_status);
CREATE INDEX IF NOT EXISTS idx_fin_inc_internal_review ON public.finance_incomes (internal_review_status);
CREATE INDEX IF NOT EXISTS idx_fin_inc_note_trgm ON public.finance_incomes USING gin (note public.gin_trgm_ops) WHERE deleted_at IS NULL;

-- finance_expenses
CREATE INDEX IF NOT EXISTS idx_fin_exp_active_date ON public.finance_expenses (expense_date DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_exp_main_cat ON public.finance_expenses (main_category_id);
CREATE INDEX IF NOT EXISTS idx_fin_exp_sub_cat ON public.finance_expenses (sub_category_id);
CREATE INDEX IF NOT EXISTS idx_fin_exp_attachment_status ON public.finance_expenses (attachment_status);
CREATE INDEX IF NOT EXISTS idx_fin_exp_accountant_status ON public.finance_expenses (accountant_status);
CREATE INDEX IF NOT EXISTS idx_fin_exp_internal_review ON public.finance_expenses (internal_review_status);
CREATE INDEX IF NOT EXISTS idx_fin_exp_item_trgm ON public.finance_expenses USING gin (item_name public.gin_trgm_ops) WHERE deleted_at IS NULL;

-- sales_invoices
CREATE INDEX IF NOT EXISTS idx_sales_invoices_issue_date ON public.sales_invoices (issue_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_order_date ON public.sales_invoices (order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_number_trgm ON public.sales_invoices USING gin (invoice_number public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_snapshot_trgm ON public.sales_invoices USING gin (customer_name_snapshot public.gin_trgm_ops);

-- payment_settlements
CREATE INDEX IF NOT EXISTS idx_ps_status_date ON public.payment_settlements (status, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_ps_reference_trgm ON public.payment_settlements USING gin (settlement_reference public.gin_trgm_ops);

-- payment_settlement_lines
CREATE INDEX IF NOT EXISTS idx_psl_settlement_line_type ON public.payment_settlement_lines (settlement_id, line_type);
CREATE INDEX IF NOT EXISTS idx_psl_settlement_matching ON public.payment_settlement_lines (settlement_id, matching_status);
CREATE INDEX IF NOT EXISTS idx_psl_transaction_date ON public.payment_settlement_lines (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_psl_external_order_trgm ON public.payment_settlement_lines USING gin (external_order_id public.gin_trgm_ops);

-- settlement_bank_allocations
CREATE INDEX IF NOT EXISTS idx_sba_txn_confirmed ON public.settlement_bank_allocations (transaction_id) WHERE status = 'confirmed';
