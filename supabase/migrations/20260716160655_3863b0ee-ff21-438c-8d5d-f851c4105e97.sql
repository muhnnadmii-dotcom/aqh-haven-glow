
-- =============================================================
-- Part A: Historical fix for sales invoice #231 (Salla deleted order 261604750)
-- =============================================================
DO $$
DECLARE
  v_invoice_id      bigint := 231;
  v_original_je_id  uuid   := '9d0e63dc-05cb-4ca9-bdf2-b10c71cde5e6';
  v_reversal_id     uuid;
  v_reversal_date   date   := '2026-05-23';
  v_ext_order_id    text   := '261604750';
  v_reason          text   := 'Salla order 261604750 وردت بحالة "محذوف" وبدون تسويات أو إشعارات؛ تم إلغاء الفاتورة وعكس قيدها آليًا.';
  v_orig_status     text;
  v_orig_number     text;
  v_orig_total      numeric;
  v_settle_count    int;
  v_note_count      int;
  v_already_reversed boolean;
BEGIN
  SELECT status, invoice_number, total_amount
    INTO v_orig_status, v_orig_number, v_orig_total
  FROM public.sales_invoices WHERE id = v_invoice_id;

  IF v_orig_status IS NULL OR v_orig_number <> 'SALLA-261604750' THEN
    RAISE NOTICE 'Invoice mismatch — skipping';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_settle_count
    FROM public.payment_settlement_lines WHERE sales_invoice_id = v_invoice_id;
  SELECT COUNT(*) INTO v_note_count
    FROM public.credit_debit_notes WHERE original_sales_invoice_id = v_invoice_id;
  IF v_settle_count > 0 OR v_note_count > 0 THEN
    RAISE NOTICE 'Invoice % has settlements(%) or notes(%) — refusing auto-cancel', v_invoice_id, v_settle_count, v_note_count;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE reversal_entry_id = v_original_je_id AND status = 'posted'
  ) INTO v_already_reversed;

  IF v_orig_status <> 'cancelled' THEN
    UPDATE public.sales_invoices SET
      status            = 'cancelled',
      payment_status    = 'unpaid',
      paid_amount       = 0,
      remaining_amount  = 0,
      settlement_status = 'not_applicable',
      internal_notes    = COALESCE(NULLIF(internal_notes,'') || E'\n', '')
                          || '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] ' || v_reason,
      updated_at        = now()
    WHERE id = v_invoice_id;
  END IF;

  IF NOT v_already_reversed THEN
    -- Insert reversal as manual/draft to avoid uniq_je_source_active conflict; linkage kept via reversal_entry_id.
    INSERT INTO public.journal_entries
      (entry_date, source_type, source_id, description, status, reversal_entry_id, total_debit, total_credit)
    VALUES
      (v_reversal_date, 'manual'::journal_source_type, NULL,
       'عكس اعتماد فاتورة مبيعات SALLA-261604750 — طلب محذوف من سلة (JE مصدر: ' || v_original_je_id::text || ')',
       'draft', v_original_je_id, v_orig_total, v_orig_total)
    RETURNING id INTO v_reversal_id;

    INSERT INTO public.journal_entry_lines
      (journal_entry_id, account_id, debit, credit, description, finance_account_id, customer_id, supplier_id)
    SELECT v_reversal_id, account_id, credit, debit,
           'عكس: ' || COALESCE(description, ''),
           finance_account_id, customer_id, supplier_id
      FROM public.journal_entry_lines WHERE journal_entry_id = v_original_je_id;

    UPDATE public.journal_entries SET status='reversed', reversed_by_entry_id=v_reversal_id, updated_at=now() WHERE id = v_original_je_id;
    UPDATE public.journal_entries SET status='posted', updated_at=now() WHERE id = v_reversal_id;
  END IF;

  UPDATE public.salla_orders SET
    cancellation_date = COALESCE(cancellation_date, v_reversal_date),
    raw_snapshot      = COALESCE(raw_snapshot, '{}'::jsonb)
                        || jsonb_build_object('cancelled', true, 'vat_return_eligible', false),
    updated_at        = now()
  WHERE external_order_id = v_ext_order_id
    AND ( cancellation_date IS NULL
       OR COALESCE(raw_snapshot->>'cancelled','false') <> 'true'
       OR COALESCE(raw_snapshot->>'vat_return_eligible','true') <> 'false' );

  IF NOT EXISTS (
    SELECT 1 FROM public.finance_audit_logs
    WHERE related_type='sales_invoice' AND related_bigint_id=v_invoice_id
      AND action='auto_cancel_deleted_salla_order'
  ) THEN
    INSERT INTO public.finance_audit_logs (related_type, related_bigint_id, action, note)
    VALUES ('sales_invoice', v_invoice_id, 'auto_cancel_deleted_salla_order', v_reason);
  END IF;
END $$;

-- =============================================================
-- Part B: Future guard — auto-cancel invoice when Salla order becomes cancelled/deleted
-- =============================================================
CREATE OR REPLACE FUNCTION private.auto_cancel_salla_invoice_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public','private'
AS $$
DECLARE
  v_pattern text := '(cancel|ملغى|ملغي|ملغاة|إلغاء|الغاء|deleted|removed|محذوف|حذف)';
  v_invoice_id bigint;
  v_invoice_total numeric;
  v_invoice_status text;
  v_je_id uuid;
  v_reversal_id uuid;
  v_settle_count int;
  v_note_count int;
BEGIN
  IF NEW.order_status IS NULL OR NEW.order_status !~* v_pattern THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.order_status IS NOT DISTINCT FROM NEW.order_status THEN RETURN NEW; END IF;

  SELECT id, total_amount, status::text
    INTO v_invoice_id, v_invoice_total, v_invoice_status
    FROM public.sales_invoices
   WHERE invoice_number = 'SALLA-' || NEW.external_order_id
   ORDER BY id DESC LIMIT 1;
  IF v_invoice_id IS NULL OR v_invoice_status='cancelled' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_settle_count FROM public.payment_settlement_lines WHERE sales_invoice_id = v_invoice_id;
  SELECT COUNT(*) INTO v_note_count FROM public.credit_debit_notes
    WHERE original_sales_invoice_id = v_invoice_id AND status='approved';

  IF v_settle_count > 0 OR v_note_count > 0 THEN
    INSERT INTO public.finance_audit_logs (related_type, related_bigint_id, action, note)
    VALUES ('sales_invoice', v_invoice_id, 'salla_cancel_needs_manual_review',
      'طلب سلة ' || NEW.external_order_id || ' وصل بحالة ' || NEW.order_status ||
      ' لكن الفاتورة لديها تسويات/إشعارات معتمدة — لم يتم تغيير شيء ماليًا.');
    RETURN NEW;
  END IF;

  UPDATE public.sales_invoices SET
    status='cancelled', payment_status='unpaid', paid_amount=0, remaining_amount=0,
    settlement_status='not_applicable',
    internal_notes = COALESCE(NULLIF(internal_notes,'') || E'\n', '')
                     || '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] '
                     || 'إلغاء آلي — طلب سلة ' || NEW.external_order_id || ' حالته ' || NEW.order_status,
    updated_at=now()
  WHERE id = v_invoice_id;

  SELECT id INTO v_je_id
    FROM public.journal_entries
   WHERE source_type='sales_invoice_approval' AND source_id = v_invoice_id::text AND status='posted'
   ORDER BY created_at DESC LIMIT 1;

  IF v_je_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE reversal_entry_id = v_je_id) THEN
    INSERT INTO public.journal_entries
      (entry_date, source_type, source_id, description, status, reversal_entry_id, total_debit, total_credit)
    VALUES
      (COALESCE(NEW.cancellation_date, CURRENT_DATE),
       'manual'::journal_source_type, NULL,
       'عكس اعتماد فاتورة SALLA-' || NEW.external_order_id || ' — إلغاء آلي (JE مصدر: ' || v_je_id::text || ')',
       'draft', v_je_id, v_invoice_total, v_invoice_total)
    RETURNING id INTO v_reversal_id;

    INSERT INTO public.journal_entry_lines
      (journal_entry_id, account_id, debit, credit, description, finance_account_id, customer_id, supplier_id)
    SELECT v_reversal_id, account_id, credit, debit, 'عكس: ' || COALESCE(description,''),
           finance_account_id, customer_id, supplier_id
    FROM public.journal_entry_lines WHERE journal_entry_id = v_je_id;

    UPDATE public.journal_entries SET status='reversed', reversed_by_entry_id=v_reversal_id, updated_at=now() WHERE id = v_je_id;
    UPDATE public.journal_entries SET status='posted', updated_at=now() WHERE id = v_reversal_id;
  END IF;

  INSERT INTO public.finance_audit_logs (related_type, related_bigint_id, action, note)
  VALUES ('sales_invoice', v_invoice_id, 'salla_auto_cancel',
    'إلغاء آلي عبر مُشغِّل لطلب سلة ' || NEW.external_order_id || ' بحالة ' || NEW.order_status);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_salla_auto_cancel_invoice ON public.salla_orders;
CREATE TRIGGER trg_salla_auto_cancel_invoice
AFTER INSERT OR UPDATE OF order_status ON public.salla_orders
FOR EACH ROW EXECUTE FUNCTION private.auto_cancel_salla_invoice_on_status();

-- =============================================================
-- Part C: Refund review classifier
-- =============================================================
CREATE OR REPLACE FUNCTION public.vat_review_refunds(p_period_id uuid)
RETURNS TABLE (
  external_order_id text,
  sales_invoice_id  bigint,
  invoice_number    text,
  provider_name     text,
  gross_sale        numeric,
  refund_total      numeric,
  invoice_total     numeric,
  classification    text,
  action_required   text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public','private'
AS $$
DECLARE
  v_start date; v_end date;
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT tp.start_date, tp.end_date INTO v_start, v_end FROM public.tax_periods tp WHERE tp.id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;

  RETURN QUERY
  WITH grouped AS (
    SELECT psl.external_order_id AS ext_id,
           MAX(psl.sales_invoice_id) AS inv_id,
           MAX(psl.matching_status)  AS matching,
           MAX(s.provider_id)        AS provider_id,
           SUM(CASE WHEN psl.line_type='sale' THEN psl.amount ELSE 0 END) AS gross_sale,
           SUM(CASE WHEN psl.line_type IN ('refund','partial_refund') THEN ABS(psl.amount) ELSE 0 END) AS refund_total
    FROM public.payment_settlement_lines psl
    JOIN public.payment_settlements s ON s.id = psl.settlement_id
    WHERE psl.external_order_id IS NOT NULL
      AND psl.transaction_date BETWEEN v_start AND v_end
    GROUP BY psl.external_order_id
    HAVING SUM(CASE WHEN psl.line_type IN ('refund','partial_refund') THEN 1 ELSE 0 END) > 0
  )
  SELECT g.ext_id, g.inv_id, si.invoice_number, pp.name,
         g.gross_sale, g.refund_total, si.total_amount,
         CASE
           WHEN g.inv_id IS NULL AND g.matching='matched_cancelled_order' THEN 'cancelled_order_no_invoice'
           WHEN si.total_amount IS NOT NULL AND ABS(si.total_amount-(g.gross_sale-g.refund_total))<=0.02 THEN 'netted_in_source'
           WHEN si.total_amount IS NOT NULL AND ABS(si.total_amount-g.gross_sale)<=0.02 AND g.refund_total>0 THEN 'needs_credit_note'
           ELSE 'amount_mismatch'
         END AS classification,
         CASE
           WHEN g.inv_id IS NULL AND g.matching='matched_cancelled_order' THEN 'none'
           WHEN si.total_amount IS NOT NULL AND ABS(si.total_amount-(g.gross_sale-g.refund_total))<=0.02 THEN 'none'
           WHEN si.total_amount IS NOT NULL AND ABS(si.total_amount-g.gross_sale)<=0.02 AND g.refund_total>0 THEN 'create_credit_note'
           ELSE 'review'
         END AS action_required
  FROM grouped g
  LEFT JOIN public.sales_invoices si ON si.id = g.inv_id
  LEFT JOIN public.payment_providers pp ON pp.id = g.provider_id
  ORDER BY 8, 1;
END $$;

GRANT EXECUTE ON FUNCTION public.vat_review_refunds(uuid) TO authenticated;

-- =============================================================
-- Part D: vat_validate_return using new classifier
-- =============================================================
CREATE OR REPLACE FUNCTION public.vat_validate_return(p_period_id uuid)
RETURNS TABLE(severity text, code text, message text, related_id bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private'
AS $function$
DECLARE
  v_start date; v_end date;
  v_vat_registered boolean; v_vat_number text;
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;

  SELECT vat_registered, NULLIF(vat_number,'') INTO v_vat_registered, v_vat_number
  FROM public.aqh_business_settings WHERE id = 1;

  RETURN QUERY
  SELECT 'error'::text, 'missing_vat_number'::text,
         'المنشأة مسجلة في ضريبة القيمة المضافة ولكن الرقم الضريبي غير مُعرَّف في إعدادات النشاط.'::text,
         NULL::bigint
  WHERE COALESCE(v_vat_registered,false) = true AND v_vat_number IS NULL

  UNION ALL
  SELECT 'error'::text, 'missing_attachment'::text,
         'فاتورة مشتريات معتمدة تخصم ضريبة مدخلات بدون مرفق: ' || COALESCE(pi.internal_reference,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND COALESCE(pi.deductible_vat_amount,0) > 0
    AND (pi.attachment_exception_reason IS NULL OR pi.attachment_exception_reason='')
    AND NOT EXISTS (SELECT 1 FROM public.finance_attachments fa
                    WHERE fa.related_type='purchase_invoice' AND fa.related_bigint_id = pi.id)

  UNION ALL
  SELECT 'error'::text, 'deductible_over_total'::text,
         'الضريبة القابلة للخصم أكبر من الضريبة الإجمالية للفاتورة: ' || COALESCE(pi.internal_reference,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.deductible_vat_amount > pi.vat_amount

  UNION ALL
  SELECT 'warning'::text, 'pending_review'::text,
         'فاتورة مشتريات لم تُعتمد: ' || COALESCE(pi.internal_reference, pi.supplier_invoice_number,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('draft','under_review')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end

  UNION ALL
  SELECT 'warning'::text, 'duplicate_invoice'::text,
         'فاتورة مورد مكررة: ' || COALESCE(pi.supplier_invoice_number,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.supplier_id IS NOT NULL AND pi.supplier_invoice_number IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.purchase_invoices d
                WHERE d.supplier_id=pi.supplier_id AND d.supplier_invoice_number=pi.supplier_invoice_number AND d.id<>pi.id)

  UNION ALL
  SELECT 'warning'::text, 'sale_draft'::text,
         'فاتورة مبيعات ما زالت مسودة داخل الفترة: ' || si.invoice_number,
         si.id
  FROM public.sales_invoices si
  WHERE si.status='draft'
    AND COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end

  UNION ALL
  SELECT 'warning'::text, 'cancelled_by_credit_note'::text,
         'فاتورة مبيعات ملغاة بالكامل بإشعار دائن: ' || si.invoice_number,
         si.id
  FROM public.sales_invoices si
  WHERE si.status IN ('approved','paid','partially_paid')
    AND COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end
    AND COALESCE(si.total_amount,0) > 0
    AND (SELECT COALESCE(SUM(cdn.total_amount),0)
         FROM public.credit_debit_notes cdn
         WHERE cdn.note_type='sales_credit_note'
           AND cdn.original_sales_invoice_id = si.id
           AND cdn.status='approved') >= si.total_amount

  UNION ALL
  -- Refund review: only real issues surface as warnings.
  -- cancelled_order_no_invoice and netted_in_source are informational (see /admin/finance/vat "مراجعة المرتجعات").
  SELECT 'warning'::text,
         CASE r.classification WHEN 'needs_credit_note' THEN 'refund_needs_credit_note' ELSE 'refund_amount_mismatch' END::text,
         CASE r.classification
           WHEN 'needs_credit_note' THEN
             'مرتجع بحاجة إشعار دائن — الطلب ' || r.external_order_id
             || ' (فاتورة ' || COALESCE(r.invoice_number,'—') || '، مرتجع '
             || to_char(r.refund_total,'FM999,999,990.00') || ' ﷼)'
           ELSE
             'فرق مبالغ في مرتجع الطلب ' || r.external_order_id
             || ' — بيع=' || to_char(r.gross_sale,'FM999,999,990.00')
             || ' مرتجع=' || to_char(r.refund_total,'FM999,999,990.00')
             || ' فاتورة=' || to_char(COALESCE(r.invoice_total,0),'FM999,999,990.00')
         END::text,
         r.sales_invoice_id
  FROM public.vat_review_refunds(p_period_id) r
  WHERE r.classification IN ('needs_credit_note','amount_mismatch');
END $function$;

GRANT EXECUTE ON FUNCTION public.vat_validate_return(uuid) TO authenticated;
