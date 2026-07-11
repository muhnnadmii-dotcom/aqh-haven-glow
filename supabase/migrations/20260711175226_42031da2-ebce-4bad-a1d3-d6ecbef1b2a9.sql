
REVOKE ALL ON FUNCTION public.next_purchase_invoice_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_purchase_invoice(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_invoice_recalc_totals(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_invoices_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_invoices_audit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_invoice_items_compute() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_invoice_items_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_invoice_items_after_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_expenses_after_purchase_link() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.next_purchase_invoice_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_purchase_invoice(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_invoice_recalc_totals(bigint) TO authenticated, service_role;
