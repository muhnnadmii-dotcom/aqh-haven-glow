ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS payment_references jsonb,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_order_reference text,
  ADD COLUMN IF NOT EXISTS source_products_raw text,
  ADD COLUMN IF NOT EXISTS customer_phone_snapshot text;

CREATE OR REPLACE FUNCTION public.salla_import_commit(p_batch jsonb, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_batch_id uuid;
  r jsonb; c jsonb; act text;
  v_id bigint;
  v_oid text; v_invno text;
  v_total numeric(14,2); v_vat numeric(14,2); v_sub numeric(14,2);
  v_ship_b numeric(14,2); v_ship_v numeric(14,2);
  v_prod_b numeric(14,2); v_prod_v numeric(14,2); v_disc numeric(14,2);
  v_provider public.sales_payment_provider;
  v_sum_taxable numeric(14,2); v_sum_vat numeric(14,2); v_sum_total numeric(14,2);
  v_complete boolean;
  v_completeness public.sales_data_completeness;
  v_stat record;
  v_disc_code text; v_payrefs jsonb; v_src_upd timestamptz;
  v_order_ref text; v_products_raw text; v_phone text;
  n_new int := 0; n_upd int := 0; n_unchanged int := 0; n_conflict int := 0;
  n_cancel int := 0; n_ccn int := 0; n_blocked int := 0; n_approved int := 0;
  n_items int := 0; n_review int := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (private.has_role(v_uid,'admin')
          OR private.has_role(v_uid,'finance_manage')
          OR private.has_role(v_uid,'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.sales_import_batches(
    sales_channel, file_name, sheet_name, mapping_snapshot, total_rows, summary_json, created_by, status)
  VALUES ('salla',
          COALESCE(p_batch->>'file_name','salla-import'),
          NULLIF(p_batch->>'sheet_name',''),
          COALESCE(p_batch->'mapping','{}'::jsonb),
          COALESCE(jsonb_array_length(p_rows),0),
          jsonb_build_object('header_row', p_batch->'header_row'),
          v_uid, 'committed')
  RETURNING id INTO v_batch_id;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows,'[]'::jsonb)) LOOP
    v_oid := NULLIF(btrim(COALESCE(r->>'external_order_id','')), '');
    CONTINUE WHEN v_oid IS NULL;
    INSERT INTO public.salla_orders(
      external_order_id, order_status, payment_status, original_total, refund_total,
      payment_method, invoice_number, cancellation_date, order_date, customer_name, batch_id, raw_snapshot)
    VALUES (
      v_oid,
      NULLIF(r->>'order_status',''),
      'unknown',
      NULLIF(r->>'original_gross_amount','')::numeric,
      0,
      NULLIF(r->>'payment_method_raw',''),
      NULLIF(btrim(COALESCE(r->>'external_invoice_number','')),''),
      CASE WHEN COALESCE((r->>'cancelled')::boolean,false) THEN NULLIF(r->>'order_date','')::date ELSE NULL END,
      NULLIF(r->>'order_date','')::date,
      NULLIF(r->>'customer_name',''),
      v_batch_id,
      r)
    ON CONFLICT (external_order_id) DO UPDATE SET
      order_status = EXCLUDED.order_status,
      payment_status = EXCLUDED.payment_status,
      original_total = EXCLUDED.original_total,
      payment_method = EXCLUDED.payment_method,
      invoice_number = COALESCE(EXCLUDED.invoice_number, public.salla_orders.invoice_number),
      cancellation_date = COALESCE(EXCLUDED.cancellation_date, public.salla_orders.cancellation_date),
      order_date = COALESCE(EXCLUDED.order_date, public.salla_orders.order_date),
      customer_name = COALESCE(EXCLUDED.customer_name, public.salla_orders.customer_name),
      batch_id = EXCLUDED.batch_id,
      raw_snapshot = EXCLUDED.raw_snapshot,
      updated_at = now();
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows,'[]'::jsonb)) LOOP
    CONTINUE WHEN NOT COALESCE((r->>'selected')::boolean, false);

    c := public.salla_classify_row(r);
    act := c->>'action';
    v_oid := NULLIF(btrim(COALESCE(r->>'external_order_id','')), '');
    v_invno := NULLIF(btrim(COALESCE(r->>'external_invoice_number','')), '');
    v_total := ROUND(COALESCE((r->>'original_gross_amount')::numeric,0),2);
    v_vat := ROUND(COALESCE((r->>'total_vat_amount')::numeric,0),2);
    v_sub := ROUND(COALESCE((r->>'total_before_vat')::numeric, v_total - v_vat),2);
    v_ship_b := ROUND(COALESCE((r->>'shipping_before_vat')::numeric,0),2);
    v_ship_v := ROUND(COALESCE((r->>'shipping_vat')::numeric,0),2);
    v_prod_b := ROUND(COALESCE((r->>'product_before_vat')::numeric,0),2);
    v_prod_v := ROUND(COALESCE((r->>'product_vat')::numeric,0),2);
    v_disc := ROUND(COALESCE((r->>'total_discount')::numeric,0),2);
    v_provider := NULLIF(NULLIF(r->>'payment_provider',''),'unknown')::public.sales_payment_provider;
    v_id := NULLIF(c->>'existing_id','')::bigint;

    -- source-only informational fields (never affect amounts / vat / payment status)
    v_disc_code := NULLIF(btrim(COALESCE(r->>'discount_code','')), '');
    v_payrefs := CASE WHEN jsonb_typeof(r->'payment_references') = 'array'
                      THEN r->'payment_references' ELSE '[]'::jsonb END;
    BEGIN
      v_src_upd := NULLIF(btrim(COALESCE(r->>'source_updated_at','')), '')::timestamptz;
    EXCEPTION WHEN others THEN v_src_upd := NULL;
    END;
    v_order_ref := NULLIF(btrim(COALESCE(r->>'external_order_reference','')), '');
    v_products_raw := NULLIF(btrim(COALESCE(r->>'source_products_raw','')), '');
    v_phone := NULLIF(btrim(COALESCE(r->>'customer_phone_snapshot','')), '');

    IF act = 'blocked' THEN n_blocked := n_blocked + 1;
    ELSIF act = 'unchanged' THEN n_unchanged := n_unchanged + 1;
    ELSIF act = 'conflict_existing_final' THEN
      n_conflict := n_conflict + 1;
      UPDATE public.sales_invoices
         SET data_completeness_status = 'needs_review'::public.sales_data_completeness,
             internal_notes = COALESCE(internal_notes || ' · ','') || 'تعارض مع ملف سلة بتاريخ ' || to_char(now(),'YYYY-MM-DD')
       WHERE id = v_id;
    ELSIF act = 'needs_credit_note' THEN
      n_ccn := n_ccn + 1;
      UPDATE public.sales_invoices
         SET data_completeness_status = 'needs_credit_note'::public.sales_data_completeness
       WHERE id = v_id;
    ELSIF act = 'cancelled_new' THEN
      n_cancel := n_cancel + 1;
    ELSIF act = 'cancel_draft' THEN
      n_cancel := n_cancel + 1;
      UPDATE public.sales_invoices SET status = 'cancelled', order_status = NULLIF(r->>'order_status','') WHERE id = v_id;
    ELSIF act IN ('new','new_missing_invoice_number','update_existing_draft') THEN
      IF v_id IS NULL THEN
        v_completeness := (CASE WHEN v_invno IS NULL
                                THEN 'missing_original_invoice'
                                ELSE 'complete' END)::public.sales_data_completeness;
        INSERT INTO public.sales_invoices(
          invoice_number, issue_date, supply_date, order_date, status, payment_status,
          sales_channel, payment_provider, settlement_status, original_payment_method,
          external_order_id, external_invoice_number, customer_name_snapshot, order_status,
          original_gross_amount, refund_amount, net_amount,
          shipping_before_vat, shipping_vat,
          discount_code, payment_references, source_updated_at,
          external_order_reference, source_products_raw, customer_phone_snapshot,
          data_completeness_status, import_batch_id, import_row_snapshot)
        VALUES (
          'SALLA-' || v_oid,
          (r->>'order_date')::date, (r->>'order_date')::date, (r->>'order_date')::date,
          'draft', 'unpaid',
          'salla', v_provider, public._salla_settlement_from_provider(v_provider::text),
          NULLIF(r->>'payment_method_raw',''),
          v_oid, v_invno, NULLIF(r->>'customer_name',''), NULLIF(r->>'order_status',''),
          v_total, 0, v_total,
          v_ship_b, v_ship_v,
          v_disc_code, v_payrefs, v_src_upd,
          v_order_ref, v_products_raw, v_phone,
          v_completeness, v_batch_id, r)
        RETURNING id INTO v_id;
        n_new := n_new + 1;
      ELSE
        UPDATE public.sales_invoices SET
          issue_date = (r->>'order_date')::date,
          supply_date = (r->>'order_date')::date,
          order_date = (r->>'order_date')::date,
          payment_provider = v_provider,
          settlement_status = public._salla_settlement_from_provider(v_provider::text),
          original_payment_method = NULLIF(r->>'payment_method_raw',''),
          external_invoice_number = COALESCE(v_invno, external_invoice_number),
          customer_name_snapshot = COALESCE(NULLIF(r->>'customer_name',''), customer_name_snapshot),
          order_status = NULLIF(r->>'order_status',''),
          original_gross_amount = v_total,
          net_amount = v_total,
          shipping_before_vat = v_ship_b,
          shipping_vat = v_ship_v,
          discount_code = COALESCE(v_disc_code, discount_code),
          payment_references = CASE WHEN jsonb_array_length(v_payrefs) > 0
                                    THEN v_payrefs
                                    ELSE COALESCE(payment_references, '[]'::jsonb) END,
          source_updated_at = COALESCE(v_src_upd, source_updated_at),
          external_order_reference = COALESCE(v_order_ref, external_order_reference),
          source_products_raw = COALESCE(v_products_raw, source_products_raw),
          customer_phone_snapshot = COALESCE(v_phone, customer_phone_snapshot),
          data_completeness_status = (CASE WHEN COALESCE(v_invno, external_invoice_number) IS NULL
                                          THEN 'missing_original_invoice'
                                          ELSE 'complete' END)::public.sales_data_completeness,
          import_batch_id = v_batch_id,
          import_row_snapshot = r
        WHERE id = v_id AND status = 'draft';
        n_upd := n_upd + 1;
      END IF;

      DELETE FROM public.sales_invoice_items WHERE invoice_id = v_id;
      IF (v_prod_b + v_disc) > 0 THEN
        INSERT INTO public.sales_invoice_items(invoice_id, description, quantity, unit_price, discount_amount, tax_code, sort_order)
        VALUES (v_id, 'منتجات طلب سلة رقم ' || v_oid, 1, ROUND(v_prod_b + v_disc,2), v_disc,
                CASE WHEN v_prod_v > 0 THEN 'standard_15' ELSE 'zero_rated' END::public.sales_invoice_tax_code, 0);
        n_items := n_items + 1;
      END IF;
      IF v_ship_b > 0 THEN
        INSERT INTO public.sales_invoice_items(invoice_id, description, quantity, unit_price, discount_amount, tax_code, sort_order)
        VALUES (v_id, 'شحن', 1, v_ship_b, 0,
                CASE WHEN v_ship_v > 0 THEN 'standard_15' ELSE 'zero_rated' END::public.sales_invoice_tax_code, 1);
        n_items := n_items + 1;
      END IF;

      PERFORM public.sales_invoice_recalc_totals(v_id);
      SELECT taxable_amount, vat_amount, total_amount, external_invoice_number
        INTO v_stat FROM public.sales_invoices WHERE id = v_id;
      v_sum_taxable := v_stat.taxable_amount; v_sum_vat := v_stat.vat_amount; v_sum_total := v_stat.total_amount;

      v_complete := v_stat.external_invoice_number IS NOT NULL
                    AND v_sum_total > 0
                    AND EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = v_id)
                    AND ABS(v_sum_total - v_total) <= 0.02
                    AND ABS(v_sum_vat - v_vat) <= 0.02
                    AND ABS(v_sum_taxable - v_sub) <= 0.02;

      IF v_stat.external_invoice_number IS NOT NULL AND NOT v_complete THEN
        UPDATE public.sales_invoices SET data_completeness_status='needs_review'::public.sales_data_completeness WHERE id = v_id;
        n_review := n_review + 1;
      END IF;

      IF v_complete THEN
        PERFORM public.approve_sales_invoice(v_id);
        n_approved := n_approved + 1;
      END IF;
    END IF;

    INSERT INTO public.finance_audit_logs(related_type, related_id, related_bigint_id, action, new_value, changed_by, note)
    VALUES ('sales_import_row', v_batch_id, v_id, 'salla_import_' || act, v_oid, v_uid, c->>'reason');

    v_details := v_details || jsonb_build_object('external_order_id', v_oid, 'action', act, 'invoice_id', v_id);
  END LOOP;

  UPDATE public.sales_import_batches SET
    imported_rows = n_new + n_upd,
    duplicate_rows = n_unchanged,
    needs_review_rows = n_conflict + n_review + n_ccn,
    error_rows = n_blocked,
    summary_json = jsonb_build_object(
      'new', n_new, 'updated_drafts', n_upd, 'unchanged', n_unchanged,
      'conflicts', n_conflict, 'cancelled', n_cancel, 'needs_credit_note', n_ccn,
      'blocked', n_blocked, 'approved', n_approved, 'items_created', n_items,
      'needs_review', n_review, 'details', v_details)
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id, 'new', n_new, 'updated_drafts', n_upd, 'unchanged', n_unchanged,
    'conflicts', n_conflict, 'cancelled', n_cancel, 'needs_credit_note', n_ccn,
    'blocked', n_blocked, 'approved', n_approved, 'items_created', n_items, 'needs_review', n_review);
END $function$;