-- 1) classify: add metadata_only_update for final invoices
CREATE OR REPLACE FUNCTION public.salla_classify_row(p_row jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid text := NULLIF(btrim(COALESCE(p_row->>'external_order_id','')), '');
  v_inv text := NULLIF(btrim(COALESCE(p_row->>'external_invoice_number','')), '');
  v_cancel boolean := COALESCE((p_row->>'cancelled')::boolean, false);
  v_total numeric(14,2) := ROUND(COALESCE((p_row->>'original_gross_amount')::numeric,0),2);
  v_vat numeric(14,2) := ROUND(COALESCE((p_row->>'total_vat_amount')::numeric,0),2);
  e record;
  v_changed boolean;
  v_disc_code text; v_payrefs jsonb; v_src_upd timestamptz;
  v_order_ref text; v_products_raw text; v_phone text;
  v_meta boolean;
BEGIN
  IF v_oid IS NULL THEN
    RETURN jsonb_build_object('action','blocked','reason','رقم الطلب مفقود');
  END IF;
  IF (p_row->>'order_date') IS NULL OR btrim(p_row->>'order_date') = '' THEN
    RETURN jsonb_build_object('action','blocked','reason','تاريخ الطلب غير صالح');
  END IF;

  SELECT id, status, external_invoice_number, total_amount, vat_amount, data_completeness_status,
         discount_code, payment_references, source_updated_at,
         external_order_reference, source_products_raw, customer_phone_snapshot
    INTO e
  FROM public.sales_invoices
  WHERE sales_channel='salla' AND external_order_id = v_oid;

  IF NOT FOUND THEN
    IF v_cancel THEN
      RETURN jsonb_build_object('action','cancelled_new','reason','طلب ملغي — يُحفظ كسجل طلب فقط');
    END IF;
    IF v_total <= 0 THEN
      RETURN jsonb_build_object('action','blocked','reason','إجمالي الطلب = 0');
    END IF;
    RETURN jsonb_build_object('action', CASE WHEN v_inv IS NULL THEN 'new_missing_invoice_number' ELSE 'new' END,
                              'reason', CASE WHEN v_inv IS NULL THEN 'طلب جديد بدون رقم فاتورة — يبقى مسودة' ELSE 'طلب جديد مكتمل' END);
  END IF;

  IF v_cancel THEN
    IF e.status = 'draft' THEN
      RETURN jsonb_build_object('action','cancel_draft','reason','إلغاء آمن لمسودة','existing_id',e.id,'existing_status',e.status);
    END IF;
    RETURN jsonb_build_object('action','needs_credit_note','reason','الطلب ملغي والفاتورة معتمدة — يلزم إشعار دائن','existing_id',e.id,'existing_status',e.status);
  END IF;

  v_changed := (COALESCE(e.external_invoice_number,'') IS DISTINCT FROM COALESCE(v_inv,''))
               OR ABS(COALESCE(e.total_amount,0) - v_total) > 0.02
               OR ABS(COALESCE(e.vat_amount,0) - v_vat) > 0.02;

  IF e.status = 'draft' THEN
    IF v_total <= 0 THEN
      RETURN jsonb_build_object('action','blocked','reason','إجمالي الطلب = 0','existing_id',e.id,'existing_status',e.status);
    END IF;
    IF v_changed OR NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = e.id) THEN
      RETURN jsonb_build_object('action','update_existing_draft','reason','مسودة موجودة — سيتم تحديثها من سلة','existing_id',e.id,'existing_status',e.status);
    END IF;
    RETURN jsonb_build_object('action','unchanged','reason','لا تغيير','existing_id',e.id,'existing_status',e.status);
  END IF;

  -- final invoice: evaluate informational source-only fields
  v_disc_code := NULLIF(btrim(COALESCE(p_row->>'discount_code','')), '');
  v_payrefs := CASE WHEN jsonb_typeof(p_row->'payment_references') = 'array'
                    THEN p_row->'payment_references' ELSE '[]'::jsonb END;
  BEGIN
    v_src_upd := NULLIF(btrim(COALESCE(p_row->>'source_updated_at','')), '')::timestamptz;
  EXCEPTION WHEN others THEN v_src_upd := NULL;
  END;
  v_order_ref := NULLIF(btrim(COALESCE(p_row->>'external_order_reference','')), '');
  v_products_raw := NULLIF(btrim(COALESCE(p_row->>'source_products_raw','')), '');
  v_phone := NULLIF(btrim(COALESCE(p_row->>'customer_phone_snapshot','')), '');

  v_meta := (v_disc_code IS NOT NULL AND v_disc_code IS DISTINCT FROM e.discount_code)
         OR (jsonb_array_length(v_payrefs) > 0 AND v_payrefs IS DISTINCT FROM COALESCE(e.payment_references,'[]'::jsonb))
         OR (v_src_upd IS NOT NULL AND (e.source_updated_at IS NULL OR v_src_upd > e.source_updated_at))
         OR (v_order_ref IS NOT NULL AND v_order_ref IS DISTINCT FROM e.external_order_reference)
         OR (v_products_raw IS NOT NULL AND v_products_raw IS DISTINCT FROM e.source_products_raw)
         OR (v_phone IS NOT NULL AND v_phone IS DISTINCT FROM e.customer_phone_snapshot);

  IF v_changed THEN
    RETURN jsonb_build_object('action','conflict_existing_final',
      'reason', CASE WHEN v_meta
                     THEN 'فاتورة نهائية وبياناتها المالية تختلف عن الملف — للمراجعة فقط، مع تحديث بيانات المصدر فقط'
                     ELSE 'فاتورة نهائية وبياناتها تختلف عن الملف — للمراجعة فقط' END,
      'existing_id',e.id,'existing_status',e.status,'metadata_changed', v_meta);
  END IF;

  IF v_meta THEN
    RETURN jsonb_build_object('action','metadata_only_update',
      'reason','فاتورة نهائية مطابقة ماليًا — تحديث بيانات المصدر فقط',
      'existing_id',e.id,'existing_status',e.status,'metadata_changed', true);
  END IF;

  RETURN jsonb_build_object('action','unchanged','reason','فاتورة نهائية مطابقة','existing_id',e.id,'existing_status',e.status);
END $function$;

-- 2) commit: batching support + metadata_only_update handling
CREATE OR REPLACE FUNCTION public.salla_import_commit(p_batch jsonb, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_batch_id uuid;
  v_existing_batch uuid;
  v_prev jsonb := '{}'::jsonb;
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
  v_meta_patch jsonb;
  n_new int := 0; n_upd int := 0; n_unchanged int := 0; n_conflict int := 0;
  n_cancel int := 0; n_ccn int := 0; n_blocked int := 0; n_approved int := 0;
  n_items int := 0; n_review int := 0; n_meta int := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (private.has_role(v_uid,'admin')
          OR private.has_role(v_uid,'finance_manage')
          OR private.has_role(v_uid,'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- reuse an existing batch when chunking a single import into several calls
  BEGIN
    v_existing_batch := NULLIF(btrim(COALESCE(p_batch->>'batch_id','')), '')::uuid;
  EXCEPTION WHEN others THEN v_existing_batch := NULL;
  END;

  IF v_existing_batch IS NOT NULL THEN
    SELECT id, COALESCE(summary_json,'{}'::jsonb) INTO v_batch_id, v_prev
      FROM public.sales_import_batches WHERE id = v_existing_batch AND sales_channel='salla';
  END IF;

  IF v_batch_id IS NULL THEN
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
  END IF;

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

    v_meta_patch := jsonb_strip_nulls(jsonb_build_object(
      'discount_code', v_disc_code,
      'source_updated_at', CASE WHEN v_src_upd IS NULL THEN NULL ELSE to_jsonb(v_src_upd) END,
      'external_order_reference', v_order_ref,
      'source_products_raw', v_products_raw,
      'customer_phone_snapshot', v_phone))
      || CASE WHEN jsonb_array_length(v_payrefs) > 0
              THEN jsonb_build_object('payment_references', v_payrefs)
              ELSE '{}'::jsonb END;

    IF act = 'blocked' THEN n_blocked := n_blocked + 1;
    ELSIF act = 'unchanged' THEN n_unchanged := n_unchanged + 1;
    ELSIF act IN ('metadata_only_update','conflict_existing_final') THEN
      -- STRICT metadata-only path: informational source fields ONLY.
      -- Never touches amounts, discounts, vat, invoice numbers, status,
      -- payment_status, paid_amount, settlements, journals or accounting dates.
      IF v_id IS NOT NULL THEN
        UPDATE public.sales_invoices SET
          discount_code = COALESCE(v_disc_code, discount_code),
          payment_references = CASE WHEN jsonb_array_length(v_payrefs) > 0
                                    THEN v_payrefs
                                    ELSE COALESCE(payment_references,'[]'::jsonb) END,
          source_updated_at = CASE WHEN v_src_upd IS NOT NULL
                                     AND (source_updated_at IS NULL OR v_src_upd > source_updated_at)
                                   THEN v_src_upd ELSE source_updated_at END,
          external_order_reference = COALESCE(v_order_ref, external_order_reference),
          source_products_raw = COALESCE(v_products_raw, source_products_raw),
          customer_phone_snapshot = COALESCE(v_phone, customer_phone_snapshot),
          import_row_snapshot = COALESCE(import_row_snapshot,'{}'::jsonb) || v_meta_patch
        WHERE id = v_id;
      END IF;

      IF act = 'metadata_only_update' THEN
        n_meta := n_meta + 1;
      ELSE
        n_conflict := n_conflict + 1;
        UPDATE public.sales_invoices
           SET data_completeness_status = 'needs_review'::public.sales_data_completeness,
               internal_notes = COALESCE(internal_notes || ' · ','') || 'تعارض مع ملف سلة بتاريخ ' || to_char(now(),'YYYY-MM-DD')
         WHERE id = v_id;
      END IF;
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
    total_rows = COALESCE(total_rows,0) + CASE WHEN v_existing_batch IS NULL THEN 0 ELSE COALESCE(jsonb_array_length(p_rows),0) END,
    imported_rows = COALESCE(imported_rows,0) * (CASE WHEN v_existing_batch IS NULL THEN 0 ELSE 1 END) + n_new + n_upd,
    duplicate_rows = COALESCE(duplicate_rows,0) * (CASE WHEN v_existing_batch IS NULL THEN 0 ELSE 1 END) + n_unchanged,
    needs_review_rows = COALESCE(needs_review_rows,0) * (CASE WHEN v_existing_batch IS NULL THEN 0 ELSE 1 END) + n_conflict + n_review + n_ccn,
    error_rows = COALESCE(error_rows,0) * (CASE WHEN v_existing_batch IS NULL THEN 0 ELSE 1 END) + n_blocked,
    summary_json = jsonb_build_object(
      'new', COALESCE((v_prev->>'new')::int,0) + n_new,
      'updated_drafts', COALESCE((v_prev->>'updated_drafts')::int,0) + n_upd,
      'metadata_updated', COALESCE((v_prev->>'metadata_updated')::int,0) + n_meta,
      'unchanged', COALESCE((v_prev->>'unchanged')::int,0) + n_unchanged,
      'conflicts', COALESCE((v_prev->>'conflicts')::int,0) + n_conflict,
      'cancelled', COALESCE((v_prev->>'cancelled')::int,0) + n_cancel,
      'needs_credit_note', COALESCE((v_prev->>'needs_credit_note')::int,0) + n_ccn,
      'blocked', COALESCE((v_prev->>'blocked')::int,0) + n_blocked,
      'approved', COALESCE((v_prev->>'approved')::int,0) + n_approved,
      'items_created', COALESCE((v_prev->>'items_created')::int,0) + n_items,
      'needs_review', COALESCE((v_prev->>'needs_review')::int,0) + n_review,
      'details', COALESCE(v_prev->'details','[]'::jsonb) || v_details)
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id, 'new', n_new, 'updated_drafts', n_upd, 'metadata_updated', n_meta,
    'unchanged', n_unchanged, 'conflicts', n_conflict, 'cancelled', n_cancel,
    'needs_credit_note', n_ccn, 'blocked', n_blocked, 'approved', n_approved,
    'items_created', n_items, 'needs_review', n_review);
END $function$;