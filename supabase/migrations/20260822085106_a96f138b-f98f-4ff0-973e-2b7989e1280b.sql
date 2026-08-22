-- 1) Internal trigger functions: not meant to be called through the API
REVOKE ALL ON FUNCTION public.enforce_expense_attachment_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_expense_normalize_classification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_income_normalize_classification() FROM PUBLIC, anon, authenticated;

-- 2) Finance alerts RPC: signed-in finance staff only (function already checks roles)
REVOKE ALL ON FUNCTION public.finance_provider_tax_invoice_alerts(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_provider_tax_invoice_alerts(date) TO authenticated, service_role;

-- 3) Internal finance helpers never called from the client: server-side only
REVOKE ALL ON FUNCTION public.income_allocated_total(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settlement_allocated_total(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_settlement_provider_invoice_deductions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_sales_invoice_settlement_status(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_settlement_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_invoice_payment_evidence(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salla_classify_row(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salla_manual_duplicate_warning(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_income_settlement_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_settlement_links(uuid) FROM PUBLIC, anon, authenticated;

-- 4) Add an explicit finance-role guard to the only remaining unguarded reporting helper
CREATE OR REPLACE FUNCTION public.preview_auto_imported_settlement_dates()
RETURNS TABLE(affected_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT COUNT(*)::integer
  FROM public.payment_settlements s
  LEFT JOIN public.payment_providers p ON p.id = s.provider_id
  WHERE s.settlement_date = DATE '2026-07-11'
    AND s.period_start IS NULL
    AND s.period_end IS NULL
    AND COALESCE(p.provider_code::text, '') = 'salla_payments'
    AND s.imported_at >= TIMESTAMPTZ '2026-07-11 00:00:00+00'
    AND s.imported_at < TIMESTAMPTZ '2026-07-13 00:00:00+00'
    AND (
      s.report_reference IS NULL
      OR s.settlement_reference LIKE 'salla_payments-%'
    )
    AND private.has_any_finance_role(auth.uid());
$function$;
REVOKE ALL ON FUNCTION public.preview_auto_imported_settlement_dates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_auto_imported_settlement_dates() TO authenticated, service_role;