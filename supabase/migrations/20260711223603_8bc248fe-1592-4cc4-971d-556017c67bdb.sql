
CREATE OR REPLACE FUNCTION public.salla_backfill_preview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total int; v_with_snap int; v_without_snap int;
  v_with_items int; v_without_items int;
  v_needs_items int; v_wont_repair int;
  v_drafts int; v_non_drafts int;
  v_exclusions jsonb;
  v_test jsonb;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COUNT(*) INTO v_total   FROM public.sales_invoices WHERE sales_channel='salla';
  SELECT COUNT(*) INTO v_with_snap FROM public.sales_invoices WHERE sales_channel='salla' AND import_row_snapshot IS NOT NULL;
  v_without_snap := v_total - v_with_snap;

  SELECT COUNT(*) INTO v_with_items
    FROM public.sales_invoices si
    WHERE si.sales_channel='salla'
      AND EXISTS(SELECT 1 FROM public.sales_invoice_items ii WHERE ii.invoice_id=si.id);
  v_without_items := v_total - v_with_items;

  -- invoices missing items whose snapshot has any product/shipping value
  SELECT COUNT(*) INTO v_needs_items
    FROM public.sales_invoices si
    WHERE si.sales_channel='salla'
      AND si.import_row_snapshot IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.sales_invoice_items ii WHERE ii.invoice_id=si.id)
      AND (
        COALESCE((si.import_row_snapshot->>'product_before_vat')::numeric,0) > 0
        OR COALESCE((si.import_row_snapshot->>'product_vat')::numeric,0) > 0
        OR COALESCE((si.import_row_snapshot->>'shipping_before_vat')::numeric,0) > 0
      );

  -- Rows that will not be repaired at all: no snapshot
  SELECT COUNT(*) INTO v_wont_repair
    FROM public.sales_invoices
    WHERE sales_channel='salla' AND import_row_snapshot IS NULL;

  SELECT COUNT(*) INTO v_drafts     FROM public.sales_invoices WHERE sales_channel='salla' AND status='draft';
  SELECT COUNT(*) INTO v_non_drafts FROM public.sales_invoices WHERE sales_channel='salla' AND status<>'draft';

  -- Detailed exclusion list: invoices that will NOT get their header updated
  -- (i.e. not draft) OR that have no snapshot. Cap at 100 rows for UI.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'invoice_number', invoice_number,
      'external_order_id', external_order_id,
      'status', status,
      'reason', reason
    ) ORDER BY invoice_number), '[]'::jsonb) INTO v_exclusions
  FROM (
    SELECT invoice_number, external_order_id, status,
      CASE
        WHEN import_row_snapshot IS NULL THEN 'لا يوجد snapshot أصلي'
        WHEN status <> 'draft' THEN 'الفاتورة معتمدة (status=' || status || ') — لن يُعدَّل رأس الفاتورة'
      END AS reason
    FROM public.sales_invoices
    WHERE sales_channel='salla'
      AND (import_row_snapshot IS NULL OR status <> 'draft')
    ORDER BY invoice_number
    LIMIT 100
  ) t;

  -- Target test invoice diagnostic
  SELECT jsonb_build_object(
    'invoice_number', si.invoice_number,
    'status', si.status,
    'items_count', (SELECT COUNT(*) FROM public.sales_invoice_items WHERE invoice_id=si.id),
    'items_subtotal', (SELECT COALESCE(SUM(quantity*unit_price - COALESCE(discount_amount,0)),0) FROM public.sales_invoice_items WHERE invoice_id=si.id),
    'header_subtotal', si.subtotal,
    'header_vat', si.vat_amount,
    'header_total', si.total_amount
  ) INTO v_test
  FROM public.sales_invoices si
  WHERE si.invoice_number='SALLA-269384344';

  RETURN jsonb_build_object(
    'total_salla_invoices', v_total,
    'with_snapshot', v_with_snap,
    'without_snapshot', v_without_snap,
    'with_items', v_with_items,
    'without_items', v_without_items,
    'needs_items_created', v_needs_items,
    'wont_repair', v_wont_repair,
    'drafts', v_drafts,
    'non_drafts', v_non_drafts,
    'headers_to_update', v_drafts,
    'exclusions', COALESCE(v_exclusions,'[]'::jsonb),
    'target_test_269384344', v_test
  );
END $function$;


CREATE OR REPLACE FUNCTION public.salla_backfill_apply()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record; snap jsonb;
  v_product_before numeric(14,2); v_product_vat numeric(14,2);
  v_ship_before numeric(14,2); v_ship_vat numeric(14,2);
  v_total numeric(14,2); v_vat numeric(14,2); v_subtotal numeric(14,2);
  v_discount numeric(14,2); v_paid numeric(14,2);
  v_pmr text; v_provider public.sales_payment_provider; v_settlement public.sales_invoice_settlement_status;
  v_completeness public.sales_data_completeness;
  v_items_created int := 0; v_invoices_updated int := 0; v_mismatch int := 0;
  v_had_items int := 0; v_failed int := 0;
  v_status_txt text;
  v_items_inserted_here int;
  v_failures jsonb := '[]'::jsonb;
  v_sum_before numeric(14,2); v_sum_vat numeric(14,2); v_sum_total numeric(14,2);
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR r IN
    SELECT * FROM public.sales_invoices
    WHERE sales_channel='salla' AND import_row_snapshot IS NOT NULL
  LOOP
    snap := r.import_row_snapshot;
    v_items_inserted_here := 0;

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

    -- Create summary items if none exist yet (safe for BOTH draft and approved invoices).
    IF EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id=r.id) THEN
      v_had_items := v_had_items + 1;
    ELSE
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
        v_items_inserted_here := v_items_inserted_here + 1;
      END IF;
      IF v_ship_before > 0 THEN
        INSERT INTO public.sales_invoice_items
          (invoice_id, description, quantity, unit_price, discount_amount, tax_code, sort_order)
        VALUES
          (r.id, 'شحن', 1, v_ship_before, 0,
           CASE WHEN v_ship_vat > 0 THEN 'standard_15'::public.sales_invoice_tax_code
                ELSE 'zero_rated'::public.sales_invoice_tax_code END,
           1);
        v_items_created := v_items_created + 1;
        v_items_inserted_here := v_items_inserted_here + 1;
      END IF;

      -- Validate the items we inserted sum to snapshot totals (±0.02)
      IF v_items_inserted_here > 0 THEN
        SELECT
          COALESCE(SUM(quantity*unit_price - COALESCE(discount_amount,0)),0),
          COALESCE(SUM(CASE WHEN tax_code='standard_15' THEN (quantity*unit_price - COALESCE(discount_amount,0))*0.15 ELSE 0 END),0)
        INTO v_sum_before, v_sum_vat
        FROM public.sales_invoice_items WHERE invoice_id=r.id;
        v_sum_total := ROUND(v_sum_before + v_sum_vat, 2);
        IF ABS(v_sum_before - v_subtotal) > 0.02
           OR ABS(v_sum_vat - v_vat) > 0.02
           OR ABS(v_sum_total - v_total) > 0.02 THEN
          v_failures := v_failures || jsonb_build_object(
            'invoice_number', r.invoice_number,
            'external_order_id', r.external_order_id,
            'status', r.status,
            'reason', format('فرق تجميع البنود: sum_before=%s vs subtotal=%s | sum_vat=%s vs vat=%s | sum_total=%s vs total=%s',
                             v_sum_before, v_subtotal, v_sum_vat, v_vat, v_sum_total, v_total)
          );
          v_failed := v_failed + 1;
        END IF;
      ELSE
        v_failures := v_failures || jsonb_build_object(
          'invoice_number', r.invoice_number,
          'external_order_id', r.external_order_id,
          'status', r.status,
          'reason', 'الفاتورة بدون بنود ولا يوجد في snapshot أي قيمة منتجات أو شحن'
        );
        v_failed := v_failed + 1;
      END IF;
    END IF;

    -- Header update ONLY for drafts (never touch approved header financials).
    IF r.status = 'draft' THEN
      IF lower(v_status_txt) = 'paid' AND v_total > 0 THEN
        v_paid := v_total;
      ELSE
        v_paid := 0;
      END IF;

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
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'invoices_updated', v_invoices_updated,
    'items_created', v_items_created,
    'invoices_with_items_already', v_had_items,
    'totals_mismatch', v_mismatch,
    'invoices_failed', v_failed,
    'failed', v_failures
  );
END $function$;
