
REVOKE EXECUTE ON FUNCTION public.post_journal_entry(date,text,public.journal_source_type,text,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reverse_journal_entry(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_trial_balance(date,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_general_ledger(uuid,date,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_accounting_period(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reopen_accounting_period(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_accounting_period(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.acct_should_post(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.acct_id(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_journal_entry_number() FROM PUBLIC, anon;
-- trigger-only funcs
REVOKE EXECUTE ON FUNCTION public.coa_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.journal_entries_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.journal_entries_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.journal_lines_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.journal_lines_recalc() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_sales_invoice() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_purchase_invoice() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_finance_income() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_finance_expense() FROM PUBLIC, anon, authenticated;
