-- 1) Enum values used by approve/cancel (previously missing)
ALTER TYPE public.journal_source_type ADD VALUE IF NOT EXISTS 'credit_debit_note_approval';
ALTER TYPE public.journal_source_type ADD VALUE IF NOT EXISTS 'credit_debit_note_cancel';

-- 2) Safe recalculation helpers (never touch total_amount / paid_amount)
CREATE OR REPLACE FUNCTION public.cdn_sync_sales_invoice(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric(14,2);
  v_paid  numeric(14,2);
  v_net   numeric(14,2);
  v_eff   numeric(14,2);
  v_status public.sales_invoice_status;
BEGIN
  IF p_invoice_id IS NULL THEN RETURN; END IF;

  SELECT total_amount, paid_amount, status
    INTO v_total, v_paid, v_status
    FROM public.sales_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(CASE WHEN note_type = 'sales_credit_note' THEN -total_amount ELSE total_amount END), 0)
    INTO v_net
    FROM public.credit_debit_notes
    WHERE original_sales_invoice_id = p_invoice_id
      AND status = 'approved'
      AND note_type IN ('sales_credit_note','sales_debit_note');

  v_eff  := GREATEST(COALESCE(v_total,0) + COALESCE(v_net,0), 0);
  v_paid := COALESCE(v_paid,0);

  UPDATE public.sales_invoices SET
    remaining_amount = GREATEST(v_eff - v_paid, 0),
    payment_status = CASE
      WHEN v_paid > v_eff THEN 'overpaid'::public.sales_invoice_payment_status
      WHEN v_paid >= v_eff THEN 'paid'::public.sales_invoice_payment_status
      WHEN v_paid <= 0 THEN 'unpaid'::public.sales_invoice_payment_status
      ELSE 'partially_paid'::public.sales_invoice_payment_status
    END,
    status = CASE
      WHEN v_status IN ('draft','cancelled') THEN v_status
      WHEN v_paid >= v_eff THEN 'paid'::public.sales_invoice_status
      WHEN v_paid <= 0 THEN 'approved'::public.sales_invoice_status
      ELSE 'partially_paid'::public.sales_invoice_status
    END
  WHERE id = p_invoice_id;
END $function$;

CREATE OR REPLACE FUNCTION public.cdn_sync_purchase_invoice(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric(14,2);
  v_paid  numeric(14,2);
  v_net   numeric(14,2);
  v_eff   numeric(14,2);
  v_status public.purchase_invoice_status;
BEGIN
  IF p_invoice_id IS NULL THEN RETURN; END IF;

  SELECT total_amount, paid_amount, status
    INTO v_total, v_paid, v_status
    FROM public.purchase_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(CASE WHEN note_type = 'purchase_credit_note' THEN -total_amount ELSE total_amount END), 0)
    INTO v_net
    FROM public.credit_debit_notes
    WHERE original_purchase_invoice_id = p_invoice_id
      AND status = 'approved'
      AND note_type IN ('purchase_credit_note','purchase_debit_note');

  v_eff  := GREATEST(COALESCE(v_total,0) + COALESCE(v_net,0), 0);
  v_paid := COALESCE(v_paid,0);

  UPDATE public.purchase_invoices SET
    remaining_amount = GREATEST(v_eff - v_paid, 0),
    payment_status = CASE
      WHEN v_paid > v_eff THEN 'overpaid'::public.purchase_payment_status
      WHEN v_paid >= v_eff THEN 'paid'::public.purchase_payment_status
      WHEN v_paid <= 0 THEN 'unpaid'::public.purchase_payment_status
      ELSE 'partially_paid'::public.purchase_payment_status
    END,
    status = CASE
      WHEN v_status IN ('draft','under_review','rejected') THEN v_status
      WHEN v_paid >= v_eff THEN 'paid'::public.purchase_invoice_status
      WHEN v_paid <= 0 THEN 'approved'::public.purchase_invoice_status
      ELSE 'partially_paid'::public.purchase_invoice_status
    END
  WHERE id = p_invoice_id;
END $function$;

CREATE OR REPLACE FUNCTION public.cdn_sync_linked_invoice(p_note_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v public.credit_debit_notes;
BEGIN
  SELECT * INTO v FROM public.credit_debit_notes WHERE id = p_note_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v.original_sales_invoice_id IS NOT NULL THEN
    PERFORM public.cdn_sync_sales_invoice(v.original_sales_invoice_id);
  END IF;
  IF v.original_purchase_invoice_id IS NOT NULL THEN
    PERFORM public.cdn_sync_purchase_invoice(v.original_purchase_invoice_id);
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.cdn_sync_sales_invoice(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cdn_sync_purchase_invoice(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cdn_sync_linked_invoice(bigint) FROM PUBLIC, anon, authenticated;

-- 3) Keep note effect after standard invoice recalculations
CREATE OR REPLACE FUNCTION public.sales_invoice_recalc_totals(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub numeric(14,2) := 0;
  v_disc numeric(14,2) := 0;
  v_taxable numeric(14,2) := 0;
  v_vat numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_paid numeric(14,2) := 0;
  v_current_status public.sales_invoice_status;
BEGIN
  SELECT
    COALESCE(SUM(ROUND(quantity*unit_price,2)),0),
    COALESCE(SUM(discount_amount),0),
    COALESCE(SUM(line_subtotal),0),
    COALESCE(SUM(line_tax_amount),0),
    COALESCE(SUM(line_total),0)
  INTO v_sub, v_disc, v_taxable, v_vat, v_total
  FROM public.sales_invoice_items WHERE invoice_id = p_invoice_id;

  v_paid := public.sales_invoice_payment_evidence(p_invoice_id);

  SELECT status INTO v_current_status FROM public.sales_invoices WHERE id = p_invoice_id;

  UPDATE public.sales_invoices SET
    subtotal = v_sub,
    discount_amount = v_disc,
    taxable_amount = v_taxable,
    vat_amount = v_vat,
    total_amount = v_total,
    paid_amount = v_paid,
    remaining_amount = GREATEST(v_total - v_paid, 0),
    payment_status = CASE
      WHEN v_paid <= 0 THEN 'unpaid'::public.sales_invoice_payment_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.sales_invoice_payment_status
      WHEN v_paid = v_total THEN 'paid'::public.sales_invoice_payment_status
      ELSE 'overpaid'::public.sales_invoice_payment_status
    END,
    status = CASE
      WHEN v_current_status IN ('draft','cancelled') THEN v_current_status
      WHEN v_paid <= 0 THEN 'approved'::public.sales_invoice_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.sales_invoice_status
      WHEN v_paid >= v_total THEN 'paid'::public.sales_invoice_status
      ELSE v_current_status
    END
  WHERE id = p_invoice_id;

  -- re-apply approved credit/debit note effect (no-op when there are none)
  PERFORM public.cdn_sync_sales_invoice(p_invoice_id);
END $function$;

CREATE OR REPLACE FUNCTION public.purchase_invoice_recalc_totals(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub numeric(14,2) := 0;
  v_disc numeric(14,2) := 0;
  v_taxable numeric(14,2) := 0;
  v_vat numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_paid_exp numeric(14,2) := 0;
  v_paid_prov numeric(14,2) := 0;
  v_paid numeric(14,2) := 0;
  v_ded_pct numeric(6,3);
  v_ded numeric(14,2);
  v_nondec numeric(14,2);
  v_vat_ded public.purchase_vat_deductibility;
  v_current public.purchase_invoice_status;
BEGIN
  SELECT
    COALESCE(SUM(ROUND(quantity*unit_price,2)),0),
    COALESCE(SUM(discount_amount),0),
    COALESCE(SUM(line_subtotal),0),
    COALESCE(SUM(line_tax_amount),0),
    COALESCE(SUM(line_total),0)
  INTO v_sub, v_disc, v_taxable, v_vat, v_total
  FROM public.purchase_invoice_items WHERE purchase_invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount),0) INTO v_paid_exp
  FROM public.finance_expenses
  WHERE purchase_invoice_id = p_invoice_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(amount),0) INTO v_paid_prov
  FROM public.purchase_invoice_provider_payments
  WHERE purchase_invoice_id = p_invoice_id AND status = 'confirmed';

  v_paid := v_paid_exp + v_paid_prov;

  SELECT vat_deductibility, deductible_percentage, status
    INTO v_vat_ded, v_ded_pct, v_current
    FROM public.purchase_invoices WHERE id = p_invoice_id;

  IF v_vat_ded = 'fully_deductible' THEN
    v_ded := v_vat; v_nondec := 0;
  ELSIF v_vat_ded = 'non_deductible' THEN
    v_ded := 0; v_nondec := v_vat;
  ELSIF v_vat_ded = 'partially_deductible' THEN
    v_ded := ROUND(v_vat * COALESCE(v_ded_pct,0) / 100.0, 2);
    v_nondec := v_vat - v_ded;
  ELSE
    v_ded := 0; v_nondec := 0;
  END IF;

  UPDATE public.purchase_invoices SET
    subtotal = v_sub,
    discount_amount = v_disc,
    taxable_amount = v_taxable,
    vat_amount = v_vat,
    deductible_vat_amount = v_ded,
    non_deductible_vat_amount = v_nondec,
    total_amount = v_total,
    paid_amount = v_paid,
    remaining_amount = GREATEST(v_total - v_paid, 0),
    payment_status = CASE
      WHEN v_paid <= 0 THEN 'unpaid'::public.purchase_payment_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.purchase_payment_status
      WHEN v_paid = v_total THEN 'paid'::public.purchase_payment_status
      ELSE 'overpaid'::public.purchase_payment_status
    END,
    status = CASE
      WHEN v_current IN ('draft','under_review','rejected') THEN v_current
      WHEN v_paid <= 0 THEN 'approved'::public.purchase_invoice_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.purchase_invoice_status
      WHEN v_paid >= v_total THEN 'paid'::public.purchase_invoice_status
      ELSE v_current
    END
  WHERE id = p_invoice_id;

  PERFORM public.cdn_sync_purchase_invoice(p_invoice_id);
END $function$;