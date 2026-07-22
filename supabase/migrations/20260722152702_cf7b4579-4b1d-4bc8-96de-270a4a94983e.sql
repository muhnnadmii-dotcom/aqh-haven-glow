CREATE OR REPLACE FUNCTION public.confirm_provider_invoice_payment(p_invoice_id bigint, p_amount numeric, p_payment_date date DEFAULT NULL::date, p_source_account_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.purchase_invoices;
  v_prov public.payment_providers;
  v_src_id uuid;
  v_src public.chart_of_accounts;
  v_ap_id uuid;
  v_ap public.chart_of_accounts;
  v_pay_id uuid;
  v_entry_id uuid;
  v_entry_num text;
  v_date date;
  v_tol numeric(14,2);
BEGIN
  IF NOT (
    private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'finance_manage'::app_role)
    OR private.has_role(auth.uid(),'finance_accountant'::app_role)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_inv FROM public.purchase_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_inv.payment_provider_id IS NULL THEN RAISE EXCEPTION 'invoice_has_no_provider'; END IF;
  IF v_inv.status IN ('draft','rejected') THEN RAISE EXCEPTION 'invoice_not_payable_in_status_%', v_inv.status; END IF;

  SELECT * INTO v_prov FROM public.payment_providers WHERE id = v_inv.payment_provider_id;
  v_tol := COALESCE(v_prov.rounding_tolerance, 0);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  IF v_inv.remaining_amount <= v_tol THEN RAISE EXCEPTION 'invoice_already_fully_paid_by_provider_wallet'; END IF;
  IF p_amount > v_inv.remaining_amount + v_tol THEN RAISE EXCEPTION 'amount_exceeds_remaining'; END IF;

  v_src_id := COALESCE(p_source_account_id, v_prov.wallet_account_id, v_prov.clearing_account_id);
  IF v_src_id IS NULL THEN RAISE EXCEPTION 'no_source_account_available'; END IF;

  IF v_src_id <> COALESCE(v_prov.wallet_account_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND v_src_id <> COALESCE(v_prov.clearing_account_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'source_account_not_allowed_for_provider';
  END IF;

  SELECT * INTO v_src FROM public.chart_of_accounts WHERE id = v_src_id;

  SELECT id INTO v_ap_id FROM public.chart_of_accounts WHERE code = '2100' LIMIT 1;
  IF v_ap_id IS NULL THEN RAISE EXCEPTION 'ap_account_not_found_code_2100'; END IF;
  SELECT * INTO v_ap FROM public.chart_of_accounts WHERE id = v_ap_id;

  v_date := COALESCE(p_payment_date, CURRENT_DATE);
  v_entry_num := 'JE-PIPP-' || to_char(now(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,4);

  INSERT INTO public.journal_entries(entry_number, entry_date, source_type, source_id, description, status, total_debit, total_credit, created_by)
  VALUES (v_entry_num, v_date, 'purchase_invoice_payment'::journal_source_type,
          'pipp:'||gen_random_uuid()::text,
          'دفع فاتورة مشتريات '||v_inv.internal_reference||' من رصيد بوابة '||v_prov.name,
          'draft'::journal_entry_status, p_amount, p_amount, auth.uid())
  RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, line_order)
  VALUES
    (v_entry_id, v_ap.id, 'الموردون (تخفيض)', p_amount, 0, v_inv.supplier_id, 0),
    (v_entry_id, v_src.id, 'تخفيض رصيد '||v_src.name_ar, 0, p_amount, NULL, 1);

  INSERT INTO public.purchase_invoice_provider_payments(
    purchase_invoice_id, provider_id, payment_date, amount, source_account_id,
    status, journal_entry_id, notes, created_by, confirmed_by, confirmed_at
  ) VALUES (
    p_invoice_id, v_inv.payment_provider_id, v_date, p_amount, v_src_id,
    'confirmed', v_entry_id, p_notes, auth.uid(), auth.uid(), now()
  ) RETURNING id INTO v_pay_id;

  PERFORM public.purchase_invoice_recalc_totals(p_invoice_id);

  RETURN jsonb_build_object('payment_id', v_pay_id, 'journal_entry_id', v_entry_id, 'entry_number', v_entry_num);
END;
$function$;