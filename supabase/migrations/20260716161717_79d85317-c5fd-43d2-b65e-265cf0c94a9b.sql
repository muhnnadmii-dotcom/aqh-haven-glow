
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
