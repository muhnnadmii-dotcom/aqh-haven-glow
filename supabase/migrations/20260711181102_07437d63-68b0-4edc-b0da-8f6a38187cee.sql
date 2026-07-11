
CREATE OR REPLACE FUNCTION public.get_accounting_performance(p_from date, p_to date)
RETURNS TABLE(
  gross_sales numeric,
  sales_discounts numeric,
  net_sales numeric,
  cogs numeric,
  gross_profit numeric,
  operating_expenses numeric,
  net_profit numeric,
  ar_balance numeric,
  ap_balance numeric,
  inventory_value numeric,
  output_vat numeric,
  deductible_input_vat numeric,
  net_vat numeric,
  cogs_available boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_gross numeric(14,2) := 0;
  v_disc numeric(14,2) := 0;
  v_net numeric(14,2) := 0;
  v_cogs numeric(14,2) := 0;
  v_cogs_avail boolean := false;
  v_opex numeric(14,2) := 0;
  v_ar numeric(14,2) := 0;
  v_ap numeric(14,2) := 0;
  v_inv numeric(14,2) := 0;
  v_out_vat numeric(14,2) := 0;
  v_in_vat numeric(14,2) := 0;
  v_cogs_acc uuid;
  v_opex_types text[] := ARRAY['operating_expense','salaries_expense','delivery_expense','government_fees','subscriptions_expense','non_deductible_vat_expense','other_expense'];
  v_ar_acc uuid;
  v_ap_acc uuid;
  v_inv_acc uuid;
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Sales (approved+)
  SELECT COALESCE(SUM(taxable_amount + discount_amount),0),
         COALESCE(SUM(discount_amount),0),
         COALESCE(SUM(taxable_amount),0),
         COALESCE(SUM(vat_amount),0)
    INTO v_gross, v_disc, v_net, v_out_vat
    FROM public.sales_invoices
   WHERE status IN ('approved','partially_paid','paid')
     AND issue_date BETWEEN p_from AND p_to;

  -- Purchases deductible input VAT
  SELECT COALESCE(SUM(deductible_vat_amount),0)
    INTO v_in_vat
    FROM public.purchase_invoices
   WHERE status IN ('approved','partially_paid','paid')
     AND issue_date BETWEEN p_from AND p_to;

  -- COGS via posted journal lines on cogs account
  SELECT id INTO v_cogs_acc FROM public.chart_of_accounts WHERE system_key='cogs' LIMIT 1;
  IF v_cogs_acc IS NOT NULL THEN
    SELECT COALESCE(SUM(l.debit - l.credit),0)
      INTO v_cogs
      FROM public.journal_entry_lines l
      JOIN public.journal_entries e ON e.id = l.journal_entry_id
     WHERE l.account_id = v_cogs_acc
       AND e.status='posted'
       AND e.entry_date BETWEEN p_from AND p_to;
    v_cogs_avail := v_cogs <> 0;
  END IF;

  -- Operating expenses via posted journal lines on expense accounts (excluding cogs, owner_drawings)
  SELECT COALESCE(SUM(l.debit - l.credit),0)
    INTO v_opex
    FROM public.journal_entry_lines l
    JOIN public.journal_entries e ON e.id = l.journal_entry_id
    JOIN public.chart_of_accounts a ON a.id = l.account_id
   WHERE e.status='posted'
     AND e.entry_date BETWEEN p_from AND p_to
     AND a.account_type='expense'
     AND (a.system_key IS NULL OR a.system_key = ANY(v_opex_types));

  -- AR / AP running balances (as of p_to)
  SELECT id INTO v_ar_acc FROM public.chart_of_accounts WHERE system_key='accounts_receivable' LIMIT 1;
  SELECT id INTO v_ap_acc FROM public.chart_of_accounts WHERE system_key='accounts_payable' LIMIT 1;
  SELECT id INTO v_inv_acc FROM public.chart_of_accounts WHERE system_key='inventory' LIMIT 1;

  IF v_ar_acc IS NOT NULL THEN
    SELECT COALESCE(SUM(l.debit - l.credit),0) INTO v_ar
      FROM public.journal_entry_lines l
      JOIN public.journal_entries e ON e.id = l.journal_entry_id
     WHERE l.account_id = v_ar_acc AND e.status='posted' AND e.entry_date <= p_to;
  END IF;
  IF v_ap_acc IS NOT NULL THEN
    SELECT COALESCE(SUM(l.credit - l.debit),0) INTO v_ap
      FROM public.journal_entry_lines l
      JOIN public.journal_entries e ON e.id = l.journal_entry_id
     WHERE l.account_id = v_ap_acc AND e.status='posted' AND e.entry_date <= p_to;
  END IF;
  IF v_inv_acc IS NOT NULL THEN
    SELECT COALESCE(SUM(l.debit - l.credit),0) INTO v_inv
      FROM public.journal_entry_lines l
      JOIN public.journal_entries e ON e.id = l.journal_entry_id
     WHERE l.account_id = v_inv_acc AND e.status='posted' AND e.entry_date <= p_to;
  END IF;
  IF v_inv = 0 THEN
    SELECT COALESCE(inventory_value,0) INTO v_inv FROM public.aqh_finance_manual_balances WHERE singleton=true LIMIT 1;
  END IF;

  gross_sales := v_gross;
  sales_discounts := v_disc;
  net_sales := v_net;
  cogs := CASE WHEN v_cogs_avail THEN v_cogs ELSE NULL END;
  gross_profit := CASE WHEN v_cogs_avail THEN v_net - v_cogs ELSE NULL END;
  operating_expenses := v_opex;
  net_profit := CASE WHEN v_cogs_avail THEN v_net - v_cogs - v_opex ELSE v_net - v_opex END;
  ar_balance := v_ar;
  ap_balance := v_ap;
  inventory_value := v_inv;
  output_vat := v_out_vat;
  deductible_input_vat := v_in_vat;
  net_vat := v_out_vat - v_in_vat;
  cogs_available := v_cogs_avail;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.get_accounting_performance(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_accounting_performance(date, date) TO authenticated, service_role;
