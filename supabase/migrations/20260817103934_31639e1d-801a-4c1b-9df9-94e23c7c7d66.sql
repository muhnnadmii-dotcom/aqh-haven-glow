CREATE OR REPLACE FUNCTION public.sales_invoice_payment_evidence(p_invoice_id bigint)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_provider public.sales_payment_provider;
  v_settle numeric(14,2) := 0;
  v_income numeric(14,2) := 0;
BEGIN
  IF p_invoice_id IS NULL THEN RETURN 0; END IF;

  SELECT payment_provider INTO v_provider FROM public.sales_invoices WHERE id = p_invoice_id;

  SELECT COALESCE(SUM(
           CASE
             WHEN l.line_type = 'sale' THEN l.amount
             WHEN l.line_type IN ('refund','partial_refund','chargeback') THEN -ABS(l.amount)
             ELSE 0
           END), 0)
    INTO v_settle
  FROM public.payment_settlement_lines l
  JOIN public.payment_settlements s ON s.id = l.settlement_id
  JOIN public.payment_providers pp ON pp.id = s.provider_id
  WHERE l.sales_invoice_id = p_invoice_id
    AND s.status <> 'cancelled'
    AND pp.provider_code::text = v_provider::text;

  SELECT COALESCE(SUM(amount),0) INTO v_income
  FROM public.finance_incomes
  WHERE sales_invoice_id = p_invoice_id AND deleted_at IS NULL;

  IF v_provider IN ('salla_payments','tabby','tamara') THEN
    -- Gateway providers: settlement evidence only, no direct-income fallback
    RETURN GREATEST(ROUND(v_settle, 2), 0);
  END IF;

  RETURN GREATEST(ROUND(CASE WHEN v_income <> 0 THEN v_income ELSE v_settle END, 2), 0);
END $function$;