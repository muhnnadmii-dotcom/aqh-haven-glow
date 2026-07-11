
-- Revoke anon EXECUTE from SECURITY DEFINER functions in public schema
REVOKE EXECUTE ON FUNCTION public.approve_sales_invoice(bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cdn_header_guard() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cdn_items_after_change() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cdn_items_guard() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cdn_recalc_totals(bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.journal_entries_delete_guard() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_sales_invoice_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sales_invoice_recalc_totals(bigint) FROM anon, PUBLIC;

-- Set immutable search_path on the flagged function
ALTER FUNCTION public.journal_entries_check_balance() SET search_path = public;
