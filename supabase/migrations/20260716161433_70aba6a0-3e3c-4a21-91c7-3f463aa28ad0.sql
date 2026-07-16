
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
  WITH period_orders AS (
    -- Orders that have a refund/partial_refund within the period.
    SELECT DISTINCT psl.external_order_id AS ext_id
    FROM public.payment_settlement_lines psl
    WHERE psl.external_order_id IS NOT NULL
      AND psl.line_type IN ('refund','partial_refund')
      AND psl.transaction_date BETWEEN v_start AND v_end
  ),
  cumulative AS (
    -- All lines for those orders across ALL dates (for classification).
    SELECT psl.external_order_id AS ext_id,
           MAX(psl.sales_invoice_id) FILTER (WHERE psl.sales_invoice_id IS NOT NULL) AS inv_id,
           MAX(psl.matching_status)  AS matching,
           MAX(s.provider_id)        AS provider_id,
           SUM(CASE WHEN psl.line_type='sale' THEN psl.amount ELSE 0 END) AS gross_sale_cum,
           SUM(CASE WHEN psl.line_type IN ('refund','partial_refund') THEN ABS(psl.amount) ELSE 0 END) AS refund_total_cum
    FROM public.payment_settlement_lines psl
    JOIN public.payment_settlements s ON s.id = psl.settlement_id
    WHERE psl.external_order_id IN (SELECT ext_id FROM period_orders)
    GROUP BY psl.external_order_id
  ),
  period_refunds AS (
    -- Refund total restricted to the period (for display only).
    SELECT psl.external_order_id AS ext_id,
           SUM(ABS(psl.amount)) AS refund_total_period
    FROM public.payment_settlement_lines psl
    WHERE psl.external_order_id IN (SELECT ext_id FROM period_orders)
      AND psl.line_type IN ('refund','partial_refund')
      AND psl.transaction_date BETWEEN v_start AND v_end
    GROUP BY psl.external_order_id
  ),
  credit_notes AS (
    SELECT cdn.original_sales_invoice_id AS inv_id,
           SUM(COALESCE(cdn.total_amount,0)) AS credit_total
    FROM public.credit_debit_notes cdn
    WHERE cdn.note_type='sales_credit_note' AND cdn.status='approved'
    GROUP BY cdn.original_sales_invoice_id
  )
  SELECT c.ext_id,
         c.inv_id,
         si.invoice_number,
         pp.name,
         c.gross_sale_cum      AS gross_sale,
         COALESCE(pr.refund_total_period, 0) AS refund_total,
         si.total_amount       AS invoice_total,
         CASE
           WHEN c.inv_id IS NULL AND c.matching='matched_cancelled_order' THEN 'cancelled_order_no_invoice'
           WHEN c.inv_id IS NULL THEN 'cancelled_order_no_invoice'
           WHEN COALESCE(cn.credit_total,0) > 0
                AND ABS(COALESCE(cn.credit_total,0) - c.refund_total_cum) <= 0.02
             THEN 'credit_note_recorded'
           WHEN si.total_amount IS NOT NULL
                AND ABS(si.total_amount - (c.gross_sale_cum - c.refund_total_cum)) <= 0.02
             THEN 'netted_in_source'
           WHEN si.total_amount IS NOT NULL
                AND ABS(si.total_amount - c.gross_sale_cum) <= 0.02
                AND c.refund_total_cum > 0
             THEN 'needs_credit_note'
           ELSE 'amount_mismatch'
         END AS classification,
         CASE
           WHEN c.inv_id IS NULL THEN 'none'
           WHEN COALESCE(cn.credit_total,0) > 0
                AND ABS(COALESCE(cn.credit_total,0) - c.refund_total_cum) <= 0.02
             THEN 'none'
           WHEN si.total_amount IS NOT NULL
                AND ABS(si.total_amount - (c.gross_sale_cum - c.refund_total_cum)) <= 0.02
             THEN 'none'
           WHEN si.total_amount IS NOT NULL
                AND ABS(si.total_amount - c.gross_sale_cum) <= 0.02
                AND c.refund_total_cum > 0
             THEN 'create_credit_note'
           ELSE 'review'
         END AS action_required
  FROM cumulative c
  LEFT JOIN period_refunds pr ON pr.ext_id = c.ext_id
  LEFT JOIN public.sales_invoices si ON si.id = c.inv_id
  LEFT JOIN public.payment_providers pp ON pp.id = c.provider_id
  LEFT JOIN credit_notes cn ON cn.inv_id = c.inv_id
  ORDER BY 8, 1;
END $$;

GRANT EXECUTE ON FUNCTION public.vat_review_refunds(uuid) TO authenticated;

-- Keep validation aligned: only surface real issues (needs_credit_note, amount_mismatch).
-- credit_note_recorded / netted_in_source / cancelled_order_no_invoice are informational.
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
