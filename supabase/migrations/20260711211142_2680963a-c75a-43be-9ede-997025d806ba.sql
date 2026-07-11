
-- 1) Enum + columns
DO $$ BEGIN
  CREATE TYPE public.sales_invoice_settlement_status AS ENUM ('pending','matched','not_applicable','manual_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS settlement_status public.sales_invoice_settlement_status,
  ADD COLUMN IF NOT EXISTS original_payment_method text;

-- 2) Helper: map free-text/provider to settlement_status
CREATE OR REPLACE FUNCTION public._salla_settlement_from_provider(p text)
RETURNS public.sales_invoice_settlement_status
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p IN ('salla_payments','tabby','tamara') THEN 'pending'::public.sales_invoice_settlement_status
    WHEN p = 'bank_transfer' THEN 'not_applicable'::public.sales_invoice_settlement_status
    ELSE 'manual_review'::public.sales_invoice_settlement_status
  END
$$;

-- 3) Preview counts
CREATE OR REPLACE FUNCTION public.salla_backfill_preview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int; v_no_items int; v_no_customer int; v_no_vat int; v_mismatch int; v_matched int;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.sales_invoices
    WHERE sales_channel='salla' AND import_row_snapshot IS NOT NULL;

  SELECT COUNT(*) INTO v_no_items
    FROM public.sales_invoices si
    WHERE si.sales_channel='salla'
      AND NOT EXISTS (SELECT 1 FROM public.sales_invoice_items ii WHERE ii.invoice_id=si.id);

  SELECT COUNT(*) INTO v_no_customer
    FROM public.sales_invoices
    WHERE sales_channel='salla' AND (customer_name_snapshot IS NULL OR btrim(customer_name_snapshot)='');

  SELECT COUNT(*) INTO v_no_vat
    FROM public.sales_invoices
    WHERE sales_channel='salla' AND COALESCE(vat_amount,0)=0 AND COALESCE(total_amount,0)>0;

  SELECT COUNT(*) INTO v_mismatch
    FROM public.sales_invoices
    WHERE sales_channel='salla'
      AND ABS(COALESCE(subtotal,0)+COALESCE(vat_amount,0)-COALESCE(total_amount,0)) > 0.02;

  SELECT COUNT(*) INTO v_matched
    FROM public.sales_invoices si
    WHERE si.sales_channel='salla' AND si.import_row_snapshot IS NOT NULL;

  RETURN jsonb_build_object(
    'total_salla_invoices', v_total,
    'invoices_to_update', v_matched,
    'items_to_create_invoices', v_no_items,
    'missing_customer_name', v_no_customer,
    'missing_vat', v_no_vat,
    'totals_mismatch', v_mismatch
  );
END $$;

REVOKE ALL ON FUNCTION public.salla_backfill_preview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.salla_backfill_preview() TO authenticated;

-- 4) Apply backfill
CREATE OR REPLACE FUNCTION public.salla_backfill_apply()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; snap jsonb;
  v_product_before numeric(14,2); v_product_vat numeric(14,2);
  v_ship_before numeric(14,2); v_ship_vat numeric(14,2);
  v_total numeric(14,2); v_vat numeric(14,2); v_subtotal numeric(14,2);
  v_discount numeric(14,2); v_paid numeric(14,2);
  v_pmr text; v_provider public.sales_payment_provider; v_settlement public.sales_invoice_settlement_status;
  v_completeness public.sales_data_completeness;
  v_items_created int := 0; v_invoices_updated int := 0; v_mismatch int := 0;
  v_status_txt text;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR r IN
    SELECT * FROM public.sales_invoices
    WHERE sales_channel='salla' AND import_row_snapshot IS NOT NULL
      AND status = 'draft'
  LOOP
    snap := r.import_row_snapshot;

    v_product_before := ROUND(COALESCE((snap->>'product_before_vat')::numeric, 0), 2);
    v_product_vat    := ROUND(COALESCE((snap->>'product_vat')::numeric, 0), 2);
    v_ship_before    := ROUND(COALESCE((snap->>'shipping_before_vat')::numeric, 0), 2);
    v_ship_vat       := ROUND(COALESCE((snap->>'shipping_vat')::numeric, 0), 2);
    v_total          := ROUND(COALESCE((snap->>'original_gross_amount')::numeric, r.total_amount), 2);
    v_vat            := ROUND(COALESCE((snap->>'total_vat_amount')::numeric, r.vat_amount), 2);
    v_subtotal       := ROUND(COALESCE((snap->>'total_before_vat')::numeric, v_total - v_vat), 2);
    v_discount       := ROUND(COALESCE((snap->>'total_discount')::numeric, r.discount_amount), 2);
    v_pmr            := NULLIF(btrim(COALESCE(snap->>'payment_method_raw','')), '');
    v_status_txt     := COALESCE(snap->>'payment_status', 'unpaid');

    v_provider := NULLIF(snap->>'payment_provider','')::public.sales_payment_provider;
    IF v_provider IS NULL AND v_pmr IS NOT NULL THEN
      v_provider := CASE
        WHEN v_pmr ILIKE '%تمارا%' OR v_pmr ILIKE '%tamara%' THEN 'tamara'
        WHEN v_pmr ILIKE '%تابي%'  OR v_pmr ILIKE '%tabby%'  THEN 'tabby'
        WHEN v_pmr ILIKE '%مدى%'   OR v_pmr ILIKE '%mada%'
          OR v_pmr ILIKE '%visa%'  OR v_pmr ILIKE '%master%'
          OR v_pmr ILIKE '%apple%' OR v_pmr ILIKE '%stc%'
          OR v_pmr ILIKE '%credit%' OR v_pmr ILIKE '%بطاقة%' THEN 'salla_payments'
        WHEN v_pmr ILIKE '%حوالة%' OR v_pmr ILIKE '%bank%' OR v_pmr ILIKE '%transfer%' THEN 'bank_transfer'
        ELSE 'other'
      END::public.sales_payment_provider;
    END IF;

    v_settlement := public._salla_settlement_from_provider(v_provider::text);

    IF ABS(v_subtotal + v_vat - v_total) > 0.02 THEN
      v_completeness := 'needs_review';
      v_mismatch := v_mismatch + 1;
    ELSE
      v_completeness := COALESCE(r.data_completeness_status, 'complete');
    END IF;

    -- Create summary items if none
    IF NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id=r.id) THEN
      IF v_product_before > 0 OR v_product_vat > 0 THEN
        INSERT INTO public.sales_invoice_items
          (invoice_id, description, quantity, unit_price, discount_amount, tax_code, sort_order)
        VALUES
          (r.id,
           'منتجات طلب سلة رقم ' || COALESCE(r.external_order_id, r.invoice_number),
           1, v_product_before, 0,
           CASE WHEN v_product_vat > 0 THEN 'standard_15'::public.sales_invoice_tax_code
                ELSE 'zero_rated'::public.sales_invoice_tax_code END,
           0);
        v_items_created := v_items_created + 1;
      END IF;
      IF v_ship_before > 0 THEN
        INSERT INTO public.sales_invoice_items
          (invoice_id, description, quantity, unit_price, discount_amount, tax_code, sort_order)
        VALUES
          (r.id, 'رسوم الشحن', 1, v_ship_before, 0,
           CASE WHEN v_ship_vat > 0 THEN 'standard_15'::public.sales_invoice_tax_code
                ELSE 'zero_rated'::public.sales_invoice_tax_code END,
           1);
        v_items_created := v_items_created + 1;
      END IF;
    END IF;

    -- Payment: gateway-paid means paid by customer, not deposited to us yet
    IF lower(v_status_txt) = 'paid' AND v_total > 0 THEN
      v_paid := v_total;
    ELSE
      v_paid := 0;
    END IF;

    -- Update header (recalc trigger from items may have zeroed paid_amount; restore here)
    UPDATE public.sales_invoices SET
      original_payment_method = v_pmr,
      payment_provider = COALESCE(v_provider, payment_provider),
      settlement_status = v_settlement,
      customer_name_snapshot = COALESCE(NULLIF(btrim(customer_name_snapshot),''), NULLIF(btrim(snap->>'customer_name'),'')),
      order_date = COALESCE(order_date, NULLIF(snap->>'order_date','')::date),
      external_order_id = COALESCE(external_order_id, snap->>'external_order_id'),
      external_invoice_number = COALESCE(external_invoice_number, snap->>'external_invoice_number'),
      subtotal = v_subtotal,
      discount_amount = v_discount,
      taxable_amount = v_subtotal,
      vat_amount = v_vat,
      total_amount = v_total,
      shipping_before_vat = v_ship_before,
      shipping_vat = v_ship_vat,
      paid_amount = v_paid,
      remaining_amount = GREATEST(v_total - v_paid, 0),
      payment_status = CASE
        WHEN v_paid <= 0 THEN 'unpaid'::public.sales_invoice_payment_status
        WHEN v_paid < v_total THEN 'partially_paid'::public.sales_invoice_payment_status
        WHEN v_paid = v_total THEN 'paid'::public.sales_invoice_payment_status
        ELSE 'overpaid'::public.sales_invoice_payment_status
      END,
      data_completeness_status = v_completeness,
      notes = CASE
        WHEN notes IS NULL OR notes ILIKE 'طريقة الدفع:%' THEN NULL
        ELSE notes
      END
    WHERE id = r.id;

    v_invoices_updated := v_invoices_updated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'invoices_updated', v_invoices_updated,
    'items_created', v_items_created,
    'totals_mismatch', v_mismatch
  );
END $$;

REVOKE ALL ON FUNCTION public.salla_backfill_apply() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.salla_backfill_apply() TO authenticated;
