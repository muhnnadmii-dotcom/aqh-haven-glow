
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
    SELECT DISTINCT psl.external_order_id AS ext_id
    FROM public.payment_settlement_lines psl
    WHERE psl.external_order_id IS NOT NULL
      AND psl.line_type IN ('refund','partial_refund')
      AND psl.transaction_date BETWEEN v_start AND v_end
  ),
  cumulative AS (
    SELECT psl.external_order_id AS ext_id,
           MAX(psl.sales_invoice_id) FILTER (WHERE psl.sales_invoice_id IS NOT NULL) AS inv_id,
           MAX(psl.matching_status)  AS matching,
           (array_agg(s.provider_id ORDER BY psl.transaction_date DESC)
              FILTER (WHERE s.provider_id IS NOT NULL))[1] AS provider_id,
           SUM(CASE WHEN psl.line_type='sale' THEN psl.amount ELSE 0 END) AS gross_sale_cum,
           SUM(CASE WHEN psl.line_type IN ('refund','partial_refund') THEN ABS(psl.amount) ELSE 0 END) AS refund_total_cum
    FROM public.payment_settlement_lines psl
    JOIN public.payment_settlements s ON s.id = psl.settlement_id
    WHERE psl.external_order_id IN (SELECT ext_id FROM period_orders)
    GROUP BY psl.external_order_id
  ),
  period_refunds AS (
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
