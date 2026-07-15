
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

  -- Purchases: standard_15 taxable base and input VAT come from ITEMS only,
  -- so out_of_scope / zero / exempt lines never inflate standard_taxable.
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

  -- Deductible / non-deductible input VAT keep using invoice-level values
  -- (they honour the invoice's deductibility split); we only recompute the
  -- taxable base and gross input VAT from standard_15 items.
  SELECT
    COALESCE(SUM(pi.deductible_vat_amount),0),
    COALESCE(SUM(pi.non_deductible_vat_amount),0)
  INTO v_deductible, v_nondeductible
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  -- Notes deltas by issue_date within period
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

  SELECT COUNT(*) INTO v_pending_review FROM public.purchase_invoices pi
    WHERE pi.status IN ('under_review','draft')
      AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  -- Missing attachment: any approved invoice that deducts input VAT and has
  -- no purchase_invoice attachment, unless a documented exception is present.
  SELECT COUNT(*) INTO v_missing_att FROM public.purchase_invoices pi
    WHERE pi.status IN ('approved','partially_paid','paid')
      AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
      AND COALESCE(pi.deductible_vat_amount,0) > 0
      AND (pi.attachment_exception_reason IS NULL OR pi.attachment_exception_reason='')
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_attachments fa
        WHERE fa.related_type='purchase_invoice' AND fa.related_bigint_id = pi.id
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
      'deductible', v_deductible,
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
      'deductible_input_vat', v_deductible,
      'adjustments', 0,
      'carried_credit_in', v_carried_in,
      'carried_credit_used', v_carried_used,
      'net_due', GREATEST(v_output_vat - v_deductible - v_carried_used, 0),
      'net_credit', GREATEST(v_deductible + v_carried_used - v_output_vat, 0)
    )
  );
  RETURN v_out;
END $function$;


CREATE OR REPLACE FUNCTION public.vat_validate_return(p_period_id uuid)
 RETURNS TABLE(severity text, code text, message text, related_id bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_start date; v_end date;
  v_vat_registered boolean;
  v_vat_number text;
  v_unlinked_refund_count int;
  v_unlinked_refund_total numeric(14,2);
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
  -- Missing attachment: any deduction of input VAT without an attachment,
  -- unless a documented exception is recorded on the invoice.
  SELECT 'error'::text, 'missing_attachment'::text,
         'فاتورة مشتريات معتمدة تخصم ضريبة مدخلات بدون مرفق: ' || COALESCE(pi.internal_reference, ''),
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
         'الضريبة القابلة للخصم أكبر من الضريبة الإجمالية للفاتورة: ' || COALESCE(pi.internal_reference, ''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.deductible_vat_amount > pi.vat_amount

  UNION ALL
  SELECT 'warning'::text, 'pending_review'::text,
         'فاتورة مشتريات لم يتم اعتمادها: ' || COALESCE(pi.internal_reference, pi.supplier_invoice_number, ''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('draft','under_review')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end

  UNION ALL
  SELECT 'warning'::text, 'duplicate_invoice'::text,
         'فاتورة مورد مكررة: ' || COALESCE(pi.supplier_invoice_number, ''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.supplier_id IS NOT NULL AND pi.supplier_invoice_number IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.purchase_invoices d
                WHERE d.supplier_id = pi.supplier_id
                  AND d.supplier_invoice_number = pi.supplier_invoice_number
                  AND d.id <> pi.id)

  UNION ALL
  SELECT 'warning'::text, 'sale_draft'::text,
         'فاتورة مبيعات ما زالت مسودة داخل الفترة: ' || si.invoice_number,
         si.id
  FROM public.sales_invoices si
  WHERE si.status = 'draft'
    AND COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end

  UNION ALL
  -- VAT rate mismatch: compare only standard_15 items, and skip suppliers
  -- flagged as non-VAT-registered (out_of_scope by design).
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
  -- Cancelled by credit note: use current CDN schema
  -- (original_sales_invoice_id, sales_credit_note, status='approved').
  SELECT 'warning'::text, 'cancelled_by_credit_note'::text,
         'فاتورة مبيعات ملغاة بالكامل بإشعار دائن: ' || si.invoice_number,
         si.id
  FROM public.sales_invoices si
  WHERE si.status IN ('approved','paid','partially_paid')
    AND COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end
    AND COALESCE(si.total_amount,0) > 0
    AND (SELECT COALESCE(SUM(cdn.total_amount),0)
         FROM public.credit_debit_notes cdn
         WHERE cdn.note_type = 'sales_credit_note'
           AND cdn.original_sales_invoice_id = si.id
           AND cdn.status = 'approved'
        ) >= si.total_amount

  UNION ALL
  -- Refunds in settlement lines linked to an invoice, without an approved
  -- sales_credit_note referencing that invoice.
  SELECT 'warning'::text, 'settlement_refund_missing_credit_note'::text,
         'مرتجع تسوية مرتبط بفاتورة بدون إشعار دائن معتمد (فاتورة #' || psl.sales_invoice_id::text || ')',
         psl.sales_invoice_id
  FROM public.payment_settlement_lines psl
  WHERE psl.line_type IN ('refund','partial_refund')
    AND psl.transaction_date BETWEEN v_start AND v_end
    AND psl.sales_invoice_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.credit_debit_notes cdn
      WHERE cdn.note_type = 'sales_credit_note'
        AND cdn.status = 'approved'
        AND cdn.original_sales_invoice_id = psl.sales_invoice_id
    )
  GROUP BY psl.sales_invoice_id;

  -- Aggregate warning for unlinked settlement refunds (line id is UUID; the
  -- return type's related_id is bigint, so we surface an aggregate instead).
  SELECT COUNT(*), COALESCE(SUM(ABS(amount)),0)
    INTO v_unlinked_refund_count, v_unlinked_refund_total
  FROM public.payment_settlement_lines psl
  WHERE psl.line_type IN ('refund','partial_refund')
    AND psl.transaction_date BETWEEN v_start AND v_end
    AND psl.sales_invoice_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.credit_debit_notes cdn
      WHERE cdn.note_type = 'sales_credit_note'
        AND cdn.status = 'approved'
        AND cdn.issue_date BETWEEN v_start AND v_end
        -- unlinked refund: nothing to correlate on invoice id, so we only
        -- rely on the count/total signal.
        AND FALSE
    );

  IF COALESCE(v_unlinked_refund_count,0) > 0 THEN
    RETURN QUERY SELECT
      'warning'::text,
      'settlement_refunds_unlinked'::text,
      ('مرتجعات تسوية غير مرتبطة بفاتورة بدون إشعارات دائنة: '
       || v_unlinked_refund_count::text
       || ' حركة بإجمالي '
       || to_char(v_unlinked_refund_total, 'FM999,999,990.00')
       || ' ﷼')::text,
      NULL::bigint;
  END IF;
END $function$;
