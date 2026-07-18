
-- Update VAT attachment checks: a purchase invoice is "documented" when
-- an attachment exists on the invoice OR on any related finance_expense.

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
    AND NOT EXISTS (
      SELECT 1 FROM public.finance_attachments fa
      WHERE fa.related_type='purchase_invoice' AND fa.related_bigint_id = pi.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.finance_expenses e
      JOIN public.finance_attachments fa
        ON fa.related_type = 'expense'
       AND fa.related_id::text = e.id::text
      WHERE e.purchase_invoice_id = pi.id
        AND e.deleted_at IS NULL
    )

  UNION ALL
  SELECT 'error'::text, 'deductible_over_total'::text,
         'الضريبة القابلة للخصم أكبر من الضريبة الإجمالية للفاتورة: ' || COALESCE(pi.internal_reference,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.deductible_vat_amount > pi.vat_amount

  UNION ALL
  SELECT 'warning'::text, 'vat_rate_mismatch'::text,
         'ضريبة فاتورة لا تطابق نسبة 15% مقارنة بالمبلغ الخاضع: ' || COALESCE(pi.internal_reference,''),
         pi.id
  FROM public.purchase_invoices pi
  JOIN LATERAL (
    SELECT COALESCE(SUM(line_subtotal),0)   AS std_taxable,
           COALESCE(SUM(line_tax_amount),0) AS std_vat
    FROM public.purchase_invoice_items it
    WHERE it.purchase_invoice_id = pi.id
      AND it.tax_code = 'standard_15'
  ) items ON TRUE
  LEFT JOIN public.finance_suppliers s ON s.id = pi.supplier_id
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND COALESCE(s.is_vat_registered, true) = true
    AND items.std_taxable > 0
    AND ABS(items.std_vat - ROUND(items.std_taxable * 0.15, 2)) > 1

  UNION ALL
  SELECT 'warning'::text, 'refund_without_credit_note'::text,
         'طلب مرتجع بدون إشعار دائن مرتبط (مبلغ: ' || COALESCE(sr.amount::text,'0') || ')',
         sr.id
  FROM public.sales_refunds sr
  WHERE sr.refund_date BETWEEN v_start AND v_end
    AND COALESCE(sr.has_credit_note, false) = false

  UNION ALL
  SELECT 'warning'::text, 'provider_fees_unmatched'::text,
         'رسوم وسيط في الفاتورة لا تطابق التسويات المرتبطة: ' || COALESCE(pi.internal_reference,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.payment_provider_id IS NOT NULL
    AND COALESCE(pi.unmatched_fee_amount, 0) <> 0

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


CREATE OR REPLACE FUNCTION public.vat_get_period_summary(p_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_start date; v_end date;
  v_out jsonb;
  v_std_sales numeric(14,2); v_output_vat numeric(14,2);
  v_zero_sales numeric(14,2); v_exempt_sales numeric(14,2); v_oos_sales numeric(14,2);
  v_std_purch numeric(14,2); v_input_vat numeric(14,2);
  v_deductible numeric(14,2); v_nondeductible numeric(14,2);
  v_pending_doc_vat numeric(14,2); v_effective_deductible numeric(14,2);
  v_pending_review int; v_missing_att int; v_dup int;
  v_zero_purch numeric(14,2); v_exempt_purch numeric(14,2);
  v_carried_in numeric(14,2); v_carried_used numeric(14,2);
  v_sales_note_taxable numeric(14,2); v_sales_note_vat numeric(14,2);
  v_purch_note_taxable numeric(14,2); v_purch_note_vat numeric(14,2);
  v_purch_note_ded numeric(14,2); v_purch_note_nd numeric(14,2);
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT start_date, end_date, carried_credit_in, carried_credit_used
    INTO v_start, v_end, v_carried_in, v_carried_used
    FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;

  SELECT
    COALESCE(SUM(CASE WHEN it.tax_code='standard_15' THEN it.line_subtotal END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='standard_15' THEN it.line_tax_amount END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='zero_rated' THEN it.line_subtotal END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='exempt' THEN it.line_subtotal END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='out_of_scope' THEN it.line_subtotal END),0)
  INTO v_std_sales, v_output_vat, v_zero_sales, v_exempt_sales, v_oos_sales
  FROM public.sales_invoices si
  JOIN public.sales_invoice_items it ON it.invoice_id = si.id
  WHERE si.status IN ('approved','partially_paid','paid')
    AND COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end;

  SELECT
    COALESCE(SUM(CASE WHEN it.tax_code='standard_15' THEN it.line_subtotal END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='standard_15' THEN it.line_tax_amount END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='zero_rated' THEN it.line_subtotal END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='exempt' THEN it.line_subtotal END),0)
  INTO v_std_purch, v_input_vat, v_zero_purch, v_exempt_purch
  FROM public.purchase_invoices pi
  JOIN public.purchase_invoice_items it ON it.purchase_invoice_id = pi.id
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  SELECT
    COALESCE(SUM(pi.deductible_vat_amount),0),
    COALESCE(SUM(pi.non_deductible_vat_amount),0)
  INTO v_deductible, v_nondeductible
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  -- Pending-document VAT: approved invoices with deductible > 0, no exception,
  -- and NO attachment on the invoice AND no attachment on any linked expense.
  SELECT COALESCE(SUM(pi.deductible_vat_amount),0)
  INTO v_pending_doc_vat
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND COALESCE(pi.deductible_vat_amount,0) > 0
    AND (pi.attachment_exception_reason IS NULL OR pi.attachment_exception_reason='')
    AND NOT EXISTS (
      SELECT 1 FROM public.finance_attachments fa
      WHERE fa.related_type='purchase_invoice' AND fa.related_bigint_id = pi.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.finance_expenses e
      JOIN public.finance_attachments fa
        ON fa.related_type='expense'
       AND fa.related_id::text = e.id::text
      WHERE e.purchase_invoice_id = pi.id
        AND e.deleted_at IS NULL
    );

  SELECT
    COALESCE(SUM(CASE WHEN note_type='sales_debit_note' THEN subtotal
                      WHEN note_type='sales_credit_note' THEN -subtotal END),0),
    COALESCE(SUM(CASE WHEN note_type='sales_debit_note' THEN vat_amount
                      WHEN note_type='sales_credit_note' THEN -vat_amount END),0)
  INTO v_sales_note_taxable, v_sales_note_vat
  FROM public.credit_debit_notes
  WHERE status='approved'
    AND note_type IN ('sales_credit_note','sales_debit_note')
    AND issue_date BETWEEN v_start AND v_end;

  SELECT
    COALESCE(SUM(CASE WHEN n.note_type='purchase_debit_note' THEN n.subtotal
                      WHEN n.note_type='purchase_credit_note' THEN -n.subtotal END),0),
    COALESCE(SUM(CASE WHEN n.note_type='purchase_debit_note' THEN n.vat_amount
                      WHEN n.note_type='purchase_credit_note' THEN -n.vat_amount END),0),
    COALESCE(SUM(
      CASE WHEN n.note_type='purchase_debit_note'
             THEN ROUND(n.vat_amount * COALESCE(pi.deductible_percentage,100)/100.0, 2)
           WHEN n.note_type='purchase_credit_note'
             THEN -ROUND(n.vat_amount * COALESCE(pi.deductible_percentage,100)/100.0, 2)
      END),0),
    COALESCE(SUM(
      CASE WHEN n.note_type='purchase_debit_note'
             THEN n.vat_amount - ROUND(n.vat_amount * COALESCE(pi.deductible_percentage,100)/100.0, 2)
           WHEN n.note_type='purchase_credit_note'
             THEN -(n.vat_amount - ROUND(n.vat_amount * COALESCE(pi.deductible_percentage,100)/100.0, 2))
      END),0)
  INTO v_purch_note_taxable, v_purch_note_vat, v_purch_note_ded, v_purch_note_nd
  FROM public.credit_debit_notes n
  LEFT JOIN public.purchase_invoices pi ON pi.id = n.original_purchase_invoice_id
  WHERE n.status='approved'
    AND n.note_type IN ('purchase_credit_note','purchase_debit_note')
    AND n.issue_date BETWEEN v_start AND v_end;

  v_std_sales := v_std_sales + v_sales_note_taxable;
  v_output_vat := v_output_vat + v_sales_note_vat;
  v_std_purch := v_std_purch + v_purch_note_taxable;
  v_input_vat := v_input_vat + v_purch_note_vat;
  v_deductible := v_deductible + v_purch_note_ded;
  v_nondeductible := v_nondeductible + v_purch_note_nd;

  v_effective_deductible := GREATEST(v_deductible - v_pending_doc_vat, 0);

  SELECT COUNT(*) INTO v_pending_review FROM public.purchase_invoices pi
    WHERE pi.status IN ('under_review','draft')
      AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  SELECT COUNT(*) INTO v_missing_att FROM public.purchase_invoices pi
    WHERE pi.status IN ('approved','partially_paid','paid')
      AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
      AND COALESCE(pi.deductible_vat_amount,0) > 0
      AND (pi.attachment_exception_reason IS NULL OR pi.attachment_exception_reason='')
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_attachments fa
        WHERE fa.related_type='purchase_invoice' AND fa.related_bigint_id = pi.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.finance_expenses e
        JOIN public.finance_attachments fa
          ON fa.related_type='expense'
         AND fa.related_id::text = e.id::text
        WHERE e.purchase_invoice_id = pi.id
          AND e.deleted_at IS NULL
      );

  SELECT COUNT(*) INTO v_dup FROM (
    SELECT pi.supplier_id, pi.supplier_invoice_number
    FROM public.purchase_invoices pi
    WHERE pi.status IN ('approved','partially_paid','paid')
      AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
      AND pi.supplier_id IS NOT NULL
      AND pi.supplier_invoice_number IS NOT NULL
    GROUP BY pi.supplier_id, pi.supplier_invoice_number
    HAVING count(*) > 1
  ) d;

  v_out := jsonb_build_object(
    'period_id', p_period_id,
    'start_date', v_start,
    'end_date', v_end,
    'sales', jsonb_build_object(
      'standard_taxable', v_std_sales,
      'output_vat', v_output_vat,
      'zero_rated', v_zero_sales,
      'exempt', v_exempt_sales,
      'out_of_scope', v_oos_sales,
      'total', v_std_sales + v_zero_sales + v_exempt_sales + v_oos_sales,
      'notes_taxable_delta', v_sales_note_taxable,
      'notes_vat_delta', v_sales_note_vat
    ),
    'purchases', jsonb_build_object(
      'standard_taxable', v_std_purch,
      'input_vat_total', v_input_vat,
      'deductible', v_effective_deductible,
      'deductible_gross', v_deductible,
      'pending_document_vat', v_pending_doc_vat,
      'non_deductible', v_nondeductible,
      'zero_rated', v_zero_purch,
      'exempt', v_exempt_purch,
      'pending_review', v_pending_review,
      'missing_attachment', v_missing_att,
      'suspected_duplicates', v_dup,
      'notes_taxable_delta', v_purch_note_taxable,
      'notes_vat_delta', v_purch_note_vat
    ),
    'result', jsonb_build_object(
      'output_vat', v_output_vat,
      'deductible_input_vat', v_effective_deductible,
      'pending_document_vat', v_pending_doc_vat,
      'adjustments', 0,
      'carried_credit_in', v_carried_in,
      'carried_credit_used', v_carried_used,
      'net_due', GREATEST(v_output_vat - v_effective_deductible - v_carried_used, 0),
      'net_credit', GREATEST(v_effective_deductible + v_carried_used - v_output_vat, 0)
    )
  );
  RETURN v_out;
END $function$;


CREATE OR REPLACE FUNCTION public.vat_get_pending_document_invoices(p_period_id uuid)
 RETURNS TABLE(
   invoice_id bigint,
   internal_reference text,
   supplier_invoice_number text,
   supplier_name text,
   invoice_date date,
   pending_vat_amount numeric,
   status text
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE v_start date; v_end date;
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;
  RETURN QUERY
  SELECT pi.id,
         pi.internal_reference,
         pi.supplier_invoice_number,
         COALESCE(fs.name, ''),
         COALESCE(pi.supply_date, pi.issue_date),
         pi.deductible_vat_amount,
         pi.status::text
  FROM public.purchase_invoices pi
  LEFT JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND COALESCE(pi.deductible_vat_amount,0) > 0
    AND (pi.attachment_exception_reason IS NULL OR pi.attachment_exception_reason='')
    AND NOT EXISTS (
      SELECT 1 FROM public.finance_attachments fa
      WHERE fa.related_type='purchase_invoice' AND fa.related_bigint_id = pi.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.finance_expenses e
      JOIN public.finance_attachments fa
        ON fa.related_type='expense'
       AND fa.related_id::text = e.id::text
      WHERE e.purchase_invoice_id = pi.id
        AND e.deleted_at IS NULL
    )
  ORDER BY pi.deductible_vat_amount DESC, COALESCE(pi.supply_date, pi.issue_date) DESC;
END $function$;

REVOKE ALL ON FUNCTION public.vat_get_pending_document_invoices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_get_pending_document_invoices(uuid) TO authenticated, service_role;
