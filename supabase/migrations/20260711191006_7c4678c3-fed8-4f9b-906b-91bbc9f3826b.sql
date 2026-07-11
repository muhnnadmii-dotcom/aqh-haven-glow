-- Revoke EXECUTE from authenticated (and PUBLIC) on SECURITY DEFINER functions
-- that are triggers or purely internal helpers. Client-callable admin RPCs
-- (approve_*/cancel_*/close_*/reopen_*/reverse_*/vat_*/get_* dashboards, role
-- helpers, actor-name lookup, import batch admin) keep their grants and rely
-- on the has_role checks embedded in the function bodies.

DO $$
DECLARE
  sig text;
  sigs text[] := ARRAY[
    -- trigger functions
    'public.cdn_header_guard()',
    'public.cdn_items_after_change()',
    'public.cdn_items_guard()',
    'public.finance_expenses_after_purchase_link()',
    'public.journal_entries_delete_guard()',
    'public.purchase_invoice_items_after_change()',
    'public.purchase_invoice_items_guard()',
    'public.purchase_invoices_audit()',
    'public.purchase_invoices_guard()',
    -- internal helpers only used by other SECURITY DEFINER functions/triggers
    'public.acct_id(text)',
    'public.acct_should_post(date)',
    'public.ensure_accounting_period(date)',
    'public.cdn_recalc_totals(bigint)',
    'public.purchase_invoice_recalc_totals(bigint)',
    'public.sales_invoice_recalc_totals(bigint)',
    'public.next_credit_debit_note_number(credit_debit_note_type)',
    'public.next_journal_entry_number()',
    'public.next_purchase_invoice_number()',
    'public.next_sales_invoice_number()',
    'public.post_journal_entry(date, text, journal_source_type, text, jsonb)'
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
  END LOOP;
END $$;