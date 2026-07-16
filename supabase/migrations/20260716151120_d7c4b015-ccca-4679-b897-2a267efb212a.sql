-- Update vat_get_period_summary to exclude deductible VAT of invoices missing attachment
-- (unless documented exception) from the effective deductible and net calc.
-- Add vat_get_pending_document_invoices RPC listing those invoices.

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
  -- and no purchase_invoice attachment. This VAT stays inside input_vat_total,
  -- is NOT added to non_deductible, but is subtracted from the effective
  -- deductible used in net calculation until the document is attached.
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
  ORDER BY pi.deductible_vat_amount DESC, COALESCE(pi.supply_date, pi.issue_date) DESC;
END $function$;

REVOKE ALL ON FUNCTION public.vat_get_pending_document_invoices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_get_pending_document_invoices(uuid) TO authenticated, service_role;