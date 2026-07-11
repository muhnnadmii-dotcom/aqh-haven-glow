
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
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;

  SELECT vat_registered, NULLIF(vat_number,'') INTO v_vat_registered, v_vat_number
  FROM public.aqh_business_settings WHERE id = 1;

  RETURN QUERY
  -- ERROR: missing tax number when registered
  SELECT 'error'::text, 'missing_vat_number'::text,
         'المنشأة مسجلة في ضريبة القيمة المضافة ولكن الرقم الضريبي غير مُعرَّف في إعدادات النشاط.'::text,
         NULL::bigint
  WHERE COALESCE(v_vat_registered,false) = true AND v_vat_number IS NULL

  UNION ALL
  SELECT 'error'::text, 'missing_attachment'::text,
         'فاتورة مشتريات معتمدة بدون مرفق: ' || COALESCE(pi.internal_reference, ''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.attachment_required = true
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
  SELECT 'warning'::text, 'vat_rate_mismatch'::text,
         'ضريبة فاتورة لا تطابق نسبة 15% مقارنة بالمبلغ الخاضع: ' || COALESCE(pi.internal_reference,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.taxable_amount > 0
    AND ABS(pi.vat_amount - ROUND(pi.taxable_amount * 0.15, 2)) > 1

  UNION ALL
  -- WARNING: refund without linked credit note (in period by refund_date)
  SELECT 'warning'::text, 'refund_without_credit_note'::text,
         'طلب مرتجع بدون إشعار دائن مرتبط (مبلغ: ' || COALESCE(sr.refund_amount::text,'0') || ')',
         sr.id
  FROM public.sales_refunds sr
  WHERE sr.refund_date BETWEEN v_start AND v_end
    AND COALESCE(sr.has_credit_note, false) = false

  UNION ALL
  -- WARNING: provider fee invoice with unmatched fee amount against settlement
  SELECT 'warning'::text, 'provider_fees_unmatched'::text,
         'رسوم وسيط في الفاتورة لا تطابق التسويات المرتبطة: ' || COALESCE(pi.internal_reference,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.payment_provider_id IS NOT NULL
    AND COALESCE(pi.unmatched_fee_amount, 0) <> 0

  UNION ALL
  -- WARNING: sales invoice fully cancelled by credit notes (informational — should not be counted as net sale)
  SELECT 'warning'::text, 'cancelled_by_credit_note'::text,
         'فاتورة مبيعات ملغاة بالكامل بإشعار دائن: ' || si.invoice_number,
         si.id
  FROM public.sales_invoices si
  WHERE si.status IN ('approved','paid','partially_paid')
    AND COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end
    AND COALESCE(si.total_amount,0) > 0
    AND (SELECT COALESCE(SUM(cdn.total_amount),0)
         FROM public.credit_debit_notes cdn
         WHERE cdn.note_type = 'credit'
           AND cdn.related_invoice_type = 'sales'
           AND cdn.related_invoice_id = si.id
           AND cdn.status IN ('approved','issued')
        ) >= si.total_amount;
END $function$;
