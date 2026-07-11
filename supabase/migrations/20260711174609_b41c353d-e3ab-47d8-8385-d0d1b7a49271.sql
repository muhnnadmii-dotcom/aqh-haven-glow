
REVOKE ALL ON FUNCTION public.sales_invoice_items_compute() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_invoice_items_after_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_incomes_after_invoice_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_invoices_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_invoice_items_guard() FROM PUBLIC, anon, authenticated;
