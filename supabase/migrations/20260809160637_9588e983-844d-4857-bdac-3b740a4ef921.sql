-- ============================================================
-- 1) PAYMENT EVIDENCE
-- ============================================================
CREATE OR REPLACE FUNCTION public.sales_invoice_payment_evidence(p_invoice_id bigint)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider public.sales_payment_provider;
  v_settle numeric(14,2) := 0;
  v_income numeric(14,2) := 0;
BEGIN
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
  WHERE l.sales_invoice_id = p_invoice_id
    AND s.status <> 'cancelled';

  SELECT COALESCE(SUM(amount),0) INTO v_income
  FROM public.finance_incomes
  WHERE sales_invoice_id = p_invoice_id AND deleted_at IS NULL;

  IF v_provider IN ('salla_payments','tabby','tamara') THEN
    -- settlement lines are the primary evidence; fall back to direct incomes
    RETURN GREATEST(ROUND(CASE WHEN v_settle <> 0 THEN v_settle ELSE v_income END, 2), 0);
  END IF;

  RETURN GREATEST(ROUND(CASE WHEN v_income <> 0 THEN v_income ELSE v_settle END, 2), 0);
END $$;

REVOKE ALL ON FUNCTION public.sales_invoice_payment_evidence(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_invoice_payment_evidence(bigint) TO authenticated, service_role;

-- ============================================================
-- 2) RECALC TOTALS uses real payment evidence
-- ============================================================
CREATE OR REPLACE FUNCTION public.sales_invoice_recalc_totals(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
END $$;

-- ============================================================
-- 3) APPROVE: recalc + validate while draft, then approve
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_sales_invoice(p_invoice_id bigint)
RETURNS sales_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE v_row public.sales_invoices;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
          OR private.has_role(auth.uid(),'finance_manage')
          OR private.has_role(auth.uid(),'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_row FROM public.sales_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice not found'; END IF;
  IF v_row.status <> 'draft' THEN
    RETURN v_row; -- idempotent
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد فاتورة بدون بنود';
  END IF;

  -- recalc FIRST while still draft
  PERFORM public.sales_invoice_recalc_totals(p_invoice_id);
  SELECT * INTO v_row FROM public.sales_invoices WHERE id = p_invoice_id;

  IF ABS(COALESCE(v_row.taxable_amount,0) + COALESCE(v_row.vat_amount,0) - COALESCE(v_row.total_amount,0)) > 0.02 THEN
    RAISE EXCEPTION 'لا يمكن الاعتماد: مجموع البنود لا يطابق إجمالي الفاتورة';
  END IF;
  IF COALESCE(v_row.total_amount,0) <= 0 THEN
    RAISE EXCEPTION 'لا يمكن اعتماد فاتورة بإجمالي صفر';
  END IF;
  IF v_row.sales_channel = 'salla' AND COALESCE(NULLIF(btrim(v_row.external_invoice_number),''),'') = '' THEN
    RAISE EXCEPTION 'لا يمكن الاعتماد: رقم الفاتورة الضريبية من سلة غير متوفر';
  END IF;
  IF v_row.data_completeness_status IN ('needs_review','needs_credit_note') THEN
    RAISE EXCEPTION 'لا يمكن الاعتماد: الفاتورة تحتاج مراجعة';
  END IF;

  UPDATE public.sales_invoices
     SET status = 'approved',
         approved_by = auth.uid(),
         approved_at = now()
   WHERE id = p_invoice_id
   RETURNING * INTO v_row;

  RETURN v_row;
END $$;

-- ============================================================
-- 4) Imported invoices: journal entry stays DRAFT
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_post_sales_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_je uuid;
BEGIN
  IF NOT (NEW.status IN ('approved','partially_paid','paid')
          AND (TG_OP='INSERT' OR OLD.status NOT IN ('approved','partially_paid','paid'))) THEN
    RETURN NEW;
  END IF;
  IF NOT public.acct_should_post(NEW.issue_date) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries
             WHERE source_type='sales_invoice_approval' AND source_id = NEW.id::text AND status <> 'reversed') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
  VALUES (NEW.issue_date, 'اعتماد فاتورة مبيعات ' || NEW.invoice_number, 'sales_invoice_approval', NEW.id::text, 'draft')
  RETURNING id INTO v_je;

  INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
  VALUES
    (v_je, public.acct_id('accounts_receivable'), 'ذمة عميل - ' || NEW.invoice_number, NEW.total_amount, 0, NEW.customer_id, 1),
    (v_je, public.acct_id('sales_revenue'), 'مبيعات - ' || NEW.invoice_number, 0, NEW.taxable_amount, NEW.customer_id, 2);
  IF NEW.vat_amount > 0 THEN
    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
    VALUES (v_je, public.acct_id('output_vat_payable'), 'ضريبة مخرجات - ' || NEW.invoice_number, 0, NEW.vat_amount, 3);
  END IF;

  -- Imported invoices keep their journal entry as DRAFT for manual review
  IF NEW.import_batch_id IS NULL THEN
    UPDATE public.journal_entries SET status='posted' WHERE id = v_je;
  END IF;
  RETURN NEW;
END $$;

-- ============================================================
-- 5) CLASSIFY one salla row against current data
-- ============================================================
CREATE OR REPLACE FUNCTION public.salla_classify_row(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_oid text := NULLIF(btrim(COALESCE(p_row->>'external_order_id','')), '');
  v_inv text := NULLIF(btrim(COALESCE(p_row->>'external_invoice_number','')), '');
  v_cancel boolean := COALESCE((p_row->>'cancelled')::boolean, false);
  v_total numeric(14,2) := ROUND(COALESCE((p_row->>'original_gross_amount')::numeric,0),2);
  v_vat numeric(14,2) := ROUND(COALESCE((p_row->>'total_vat_amount')::numeric,0),2);
  e record;
  v_changed boolean;
BEGIN
  IF v_oid IS NULL THEN
    RETURN jsonb_build_object('action','blocked','reason','رقم الطلب مفقود');
  END IF;
  IF (p_row->>'order_date') IS NULL OR btrim(p_row->>'order_date') = '' THEN
    RETURN jsonb_build_object('action','blocked','reason','تاريخ الطلب غير صالح');
  END IF;

  SELECT id, status, external_invoice_number, total_amount, vat_amount, data_completeness_status
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
    IF v_changed OR NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = e.id) THEN
      RETURN jsonb_build_object('action','update_existing_draft','reason','مسودة موجودة — سيتم تحديثها من سلة','existing_id',e.id,'existing_status',e.status);
    END IF;
    RETURN jsonb_build_object('action','unchanged','reason','لا تغيير','existing_id',e.id,'existing_status',e.status);
  END IF;

  IF v_changed THEN
    RETURN jsonb_build_object('action','conflict_existing_final','reason','فاتورة نهائية وبياناتها تختلف عن الملف — للمراجعة فقط','existing_id',e.id,'existing_status',e.status);
  END IF;
  RETURN jsonb_build_object('action','unchanged','reason','فاتورة نهائية مطابقة','existing_id',e.id,'existing_status',e.status);
END $$;

REVOKE ALL ON FUNCTION public.salla_classify_row(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salla_classify_row(jsonb) TO authenticated, service_role;

-- ============================================================
-- 6) PREVIEW rows
-- ============================================================
CREATE OR REPLACE FUNCTION public.salla_import_preview(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE r jsonb; out_arr jsonb := '[]'::jsonb; c jsonb;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
          OR private.has_role(auth.uid(),'finance_manage')
          OR private.has_role(auth.uid(),'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows,'[]'::jsonb)) LOOP
    c := public.salla_classify_row(r);
    out_arr := out_arr || jsonb_build_object(
      'rowNo', (r->>'rowNo')::int,
      'external_order_id', r->>'external_order_id'
    ) || c;
  END LOOP;
  RETURN out_arr;
END $$;

REVOKE ALL ON FUNCTION public.salla_import_preview(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salla_import_preview(jsonb) TO authenticated, service_role;

-- ============================================================
-- 7) ATOMIC COMMIT
-- ============================================================
CREATE OR REPLACE FUNCTION public.salla_import_commit(p_batch jsonb, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
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
  v_stat record;
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

  -- salla_orders upsert for EVERY parsed row
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

  -- Invoice work only for selected rows
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

    IF act = 'blocked' THEN n_blocked := n_blocked + 1;
    ELSIF act = 'unchanged' THEN n_unchanged := n_unchanged + 1;
    ELSIF act = 'conflict_existing_final' THEN
      n_conflict := n_conflict + 1;
      UPDATE public.sales_invoices
         SET data_completeness_status = 'needs_review',
             internal_notes = COALESCE(internal_notes || ' · ','') || 'تعارض مع ملف سلة بتاريخ ' || to_char(now(),'YYYY-MM-DD')
       WHERE id = v_id;
    ELSIF act = 'needs_credit_note' THEN
      n_ccn := n_ccn + 1;
      UPDATE public.sales_invoices
         SET data_completeness_status = 'needs_credit_note'
       WHERE id = v_id;
    ELSIF act = 'cancelled_new' THEN
      n_cancel := n_cancel + 1;
    ELSIF act = 'cancel_draft' THEN
      n_cancel := n_cancel + 1;
      UPDATE public.sales_invoices SET status = 'cancelled', order_status = NULLIF(r->>'order_status','') WHERE id = v_id;
    ELSIF act IN ('new','new_missing_invoice_number','update_existing_draft') THEN
      IF v_id IS NULL THEN
        INSERT INTO public.sales_invoices(
          invoice_number, issue_date, supply_date, order_date, status, payment_status,
          sales_channel, payment_provider, settlement_status, original_payment_method,
          external_order_id, external_invoice_number, customer_name_snapshot, order_status,
          original_gross_amount, refund_amount, net_amount,
          shipping_before_vat, shipping_vat,
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
          CASE WHEN v_invno IS NULL THEN 'missing_original_invoice' ELSE 'complete' END,
          v_batch_id, r)
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
          data_completeness_status = CASE WHEN COALESCE(v_invno, external_invoice_number) IS NULL
                                          THEN 'missing_original_invoice' ELSE 'complete' END,
          import_batch_id = v_batch_id,
          import_row_snapshot = r
        WHERE id = v_id AND status = 'draft';
        n_upd := n_upd + 1;
      END IF;

      -- rebuild items (draft only)
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
                    AND ABS(v_sum_total - v_total) <= 0.02
                    AND ABS(v_sum_vat - v_vat) <= 0.02
                    AND ABS(v_sum_taxable - v_sub) <= 0.02;

      IF v_stat.external_invoice_number IS NOT NULL AND NOT v_complete THEN
        UPDATE public.sales_invoices SET data_completeness_status='needs_review' WHERE id = v_id;
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
END $$;

REVOKE ALL ON FUNCTION public.salla_import_commit(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salla_import_commit(jsonb, jsonb) TO authenticated, service_role;

-- ============================================================
-- 8) SAFE SCOPED BACKFILL (prepare only, nothing executed here)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salla_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_date date NOT NULL,
  to_date date,
  invoice_ids bigint[],
  preview_json jsonb NOT NULL,
  applied_at timestamptz,
  applied_json jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.salla_backfill_runs TO authenticated;
GRANT ALL ON public.salla_backfill_runs TO service_role;
ALTER TABLE public.salla_backfill_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance can read backfill runs" ON public.salla_backfill_runs;
CREATE POLICY "finance can read backfill runs" ON public.salla_backfill_runs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

DROP TRIGGER IF EXISTS salla_backfill_runs_touch ON public.salla_backfill_runs;
CREATE TRIGGER salla_backfill_runs_touch BEFORE UPDATE ON public.salla_backfill_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.salla_backfill_preview_v2(
  p_from date DEFAULT DATE '2026-07-16',
  p_to date DEFAULT NULL,
  p_invoice_ids bigint[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_from date := GREATEST(COALESCE(p_from, DATE '2026-07-16'), DATE '2026-07-16');
  v_res jsonb; v_id uuid;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH t AS (
    SELECT si.*,
      (SELECT COUNT(*) FROM public.sales_invoice_items ii WHERE ii.invoice_id=si.id) AS items_count,
      EXISTS (SELECT 1 FROM public.payment_settlement_lines l JOIN public.payment_settlements s ON s.id=l.settlement_id
              WHERE l.sales_invoice_id=si.id AND l.line_type='sale' AND s.status<>'cancelled') AS has_settlement,
      EXISTS (SELECT 1 FROM public.finance_incomes fi WHERE fi.sales_invoice_id=si.id AND fi.deleted_at IS NULL) AS has_income
    FROM public.sales_invoices si
    WHERE si.sales_channel='salla'
      AND si.issue_date >= v_from
      AND (p_to IS NULL OR si.issue_date <= p_to)
      AND (p_invoice_ids IS NULL OR si.id = ANY(p_invoice_ids))
  )
  SELECT jsonb_build_object(
    'from_date', v_from,
    'to_date', p_to,
    'targeted', COUNT(*),
    'with_invoice_number', COUNT(*) FILTER (WHERE external_invoice_number IS NOT NULL),
    'without_invoice_number', COUNT(*) FILTER (WHERE external_invoice_number IS NULL),
    'with_items', COUNT(*) FILTER (WHERE items_count > 0),
    'without_items', COUNT(*) FILTER (WHERE items_count = 0),
    'with_settlement_sale', COUNT(*) FILTER (WHERE has_settlement),
    'with_direct_income', COUNT(*) FILTER (WHERE has_income),
    'drafts', COUNT(*) FILTER (WHERE status='draft'),
    'finals', COUNT(*) FILTER (WHERE status<>'draft'),
    'totals_mismatch', COUNT(*) FILTER (WHERE import_row_snapshot IS NOT NULL
        AND ABS(COALESCE((import_row_snapshot->>'original_gross_amount')::numeric,0)
              - COALESCE((import_row_snapshot->>'total_before_vat')::numeric,0)
              - COALESCE((import_row_snapshot->>'total_vat_amount')::numeric,0)) > 0.02),
    'no_snapshot', COUNT(*) FILTER (WHERE import_row_snapshot IS NULL),
    'will_build_items', COUNT(*) FILTER (WHERE status='draft' AND items_count=0 AND import_row_snapshot IS NOT NULL),
    'will_approve', COUNT(*) FILTER (WHERE status='draft' AND import_row_snapshot IS NOT NULL AND external_invoice_number IS NOT NULL),
    'will_stay_draft', COUNT(*) FILTER (WHERE status='draft' AND external_invoice_number IS NULL),
    'conflicts_final_skipped', COUNT(*) FILTER (WHERE status<>'draft'),
    'sample', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'invoice_number', x.invoice_number, 'status', x.status,
        'external_invoice_number', x.external_invoice_number, 'items', x.items_count,
        'settlement', x.has_settlement, 'income', x.has_income, 'total', x.total_amount))
      FROM (SELECT * FROM t ORDER BY issue_date, id LIMIT 100) x), '[]'::jsonb)
  ) INTO v_res FROM t;

  INSERT INTO public.salla_backfill_runs(from_date, to_date, invoice_ids, preview_json)
  VALUES (v_from, p_to, p_invoice_ids, v_res) RETURNING id INTO v_id;

  RETURN v_res || jsonb_build_object('preview_id', v_id);
END $$;

REVOKE ALL ON FUNCTION public.salla_backfill_preview_v2(date, date, bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salla_backfill_preview_v2(date, date, bigint[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.salla_backfill_apply_v2(p_preview_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  pr record; si record; snap jsonb;
  v_prod_b numeric(14,2); v_prod_v numeric(14,2);
  v_ship_b numeric(14,2); v_ship_v numeric(14,2);
  v_total numeric(14,2); v_vat numeric(14,2); v_sub numeric(14,2); v_disc numeric(14,2);
  n_items int := 0; n_approved int := 0; n_review int := 0; n_skipped int := 0; n_touched int := 0;
  v_after record; v_res jsonb;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO pr FROM public.salla_backfill_runs WHERE id = p_preview_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'preview not found — شغّل المعاينة أولًا'; END IF;
  IF pr.applied_at IS NOT NULL THEN RAISE EXCEPTION 'تم تنفيذ هذه المعاينة مسبقًا'; END IF;
  IF pr.from_date < DATE '2026-07-16' THEN RAISE EXCEPTION 'النطاق غير مسموح قبل 2026-07-16'; END IF;

  FOR si IN
    SELECT * FROM public.sales_invoices
    WHERE sales_channel='salla'
      AND status = 'draft'
      AND import_row_snapshot IS NOT NULL
      AND issue_date >= pr.from_date
      AND (pr.to_date IS NULL OR issue_date <= pr.to_date)
      AND (pr.invoice_ids IS NULL OR id = ANY(pr.invoice_ids))
    ORDER BY issue_date, id
  LOOP
    snap := si.import_row_snapshot;
    v_prod_b := ROUND(COALESCE((snap->>'product_before_vat')::numeric,0),2);
    v_prod_v := ROUND(COALESCE((snap->>'product_vat')::numeric,0),2);
    v_ship_b := ROUND(COALESCE((snap->>'shipping_before_vat')::numeric,0),2);
    v_ship_v := ROUND(COALESCE((snap->>'shipping_vat')::numeric,0),2);
    v_total  := ROUND(COALESCE((snap->>'original_gross_amount')::numeric, si.original_gross_amount),2);
    v_vat    := ROUND(COALESCE((snap->>'total_vat_amount')::numeric,0),2);
    v_sub    := ROUND(COALESCE((snap->>'total_before_vat')::numeric, v_total - v_vat),2);
    v_disc   := ROUND(COALESCE((snap->>'total_discount')::numeric,0),2);

    IF NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = si.id) THEN
      IF (v_prod_b + v_disc) > 0 THEN
        INSERT INTO public.sales_invoice_items(invoice_id, description, quantity, unit_price, discount_amount, tax_code, sort_order)
        VALUES (si.id, 'منتجات طلب سلة رقم ' || COALESCE(si.external_order_id, si.invoice_number), 1,
                ROUND(v_prod_b + v_disc,2), v_disc,
                CASE WHEN v_prod_v > 0 THEN 'standard_15' ELSE 'zero_rated' END::public.sales_invoice_tax_code, 0);
        n_items := n_items + 1;
      END IF;
      IF v_ship_b > 0 THEN
        INSERT INTO public.sales_invoice_items(invoice_id, description, quantity, unit_price, discount_amount, tax_code, sort_order)
        VALUES (si.id, 'شحن', 1, v_ship_b, 0,
                CASE WHEN v_ship_v > 0 THEN 'standard_15' ELSE 'zero_rated' END::public.sales_invoice_tax_code, 1);
        n_items := n_items + 1;
      END IF;
    END IF;

    PERFORM public.sales_invoice_recalc_totals(si.id);
    n_touched := n_touched + 1;
    SELECT taxable_amount, vat_amount, total_amount, external_invoice_number
      INTO v_after FROM public.sales_invoices WHERE id = si.id;

    IF v_after.external_invoice_number IS NULL THEN
      n_skipped := n_skipped + 1;
    ELSIF ABS(v_after.total_amount - v_total) > 0.02
       OR ABS(v_after.vat_amount - v_vat) > 0.02
       OR ABS(v_after.taxable_amount - v_sub) > 0.02 THEN
      UPDATE public.sales_invoices SET data_completeness_status='needs_review' WHERE id = si.id;
      n_review := n_review + 1;
    ELSE
      UPDATE public.sales_invoices SET data_completeness_status='complete' WHERE id = si.id;
      PERFORM public.approve_sales_invoice(si.id);
      n_approved := n_approved + 1;
    END IF;
  END LOOP;

  v_res := jsonb_build_object('touched', n_touched, 'items_created', n_items,
    'approved', n_approved, 'needs_review', n_review, 'left_draft_missing_invoice_no', n_skipped);

  UPDATE public.salla_backfill_runs SET applied_at = now(), applied_json = v_res WHERE id = p_preview_id;
  RETURN v_res;
END $$;

REVOKE ALL ON FUNCTION public.salla_backfill_apply_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salla_backfill_apply_v2(uuid) TO authenticated, service_role;

-- Retire unsafe legacy repair functions
DROP FUNCTION IF EXISTS public.salla_backfill_apply();
DROP FUNCTION IF EXISTS public.salla_backfill_preview();
