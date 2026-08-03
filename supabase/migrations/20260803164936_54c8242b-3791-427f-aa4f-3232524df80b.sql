CREATE OR REPLACE FUNCTION public.approve_purchase_invoice(p_invoice_id bigint)
 RETURNS purchase_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_row public.purchase_invoices;
  v_registered boolean;
  v_target public.purchase_invoice_status;
  v_je uuid;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
          OR private.has_role(auth.uid(),'finance_manage')
          OR private.has_role(auth.uid(),'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_row FROM public.purchase_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;

  -- Idempotent: already approved/paid → no second journal entry, no changes.
  IF v_row.status IN ('approved','partially_paid','paid') THEN
    RETURN v_row;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.purchase_invoice_items WHERE purchase_invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد فاتورة بدون بنود';
  END IF;

  -- 1) Payment-gateway fee invoices: default deductibility BEFORE posting.
  --    Never overrides an explicit manual non_deductible / partially_deductible choice.
  IF v_row.payment_provider_id IS NOT NULL
     AND v_row.vat_deductibility = 'pending_review'
     AND COALESCE(v_row.vat_document_status::text,'') = 'valid'
     AND COALESCE(v_row.vat_amount,0) > 0 THEN
    SELECT is_vat_registered INTO v_registered
      FROM public.finance_suppliers WHERE id = v_row.supplier_id;
    IF v_registered IS TRUE THEN
      UPDATE public.purchase_invoices
         SET vat_deductibility = 'fully_deductible'::public.purchase_vat_deductibility,
             deductible_percentage = 100,
             non_deductible_reason = NULL
       WHERE id = p_invoice_id;
    END IF;
  END IF;

  -- 2) Recalculate items / totals / deductible VAT while still in draft.
  PERFORM public.purchase_invoice_recalc_totals(p_invoice_id);
  SELECT * INTO v_row FROM public.purchase_invoices WHERE id = p_invoice_id;

  IF COALESCE(v_row.total_amount,0) <= 0 THEN
    RAISE EXCEPTION 'لا يمكن اعتماد فاتورة بإجمالي صفر. راجع البنود.';
  END IF;
  IF ROUND(COALESCE(v_row.taxable_amount,0) + COALESCE(v_row.vat_amount,0),2) <> ROUND(v_row.total_amount,2) THEN
    RAISE EXCEPTION 'الإجماليات غير متسقة (الوعاء + الضريبة لا يساوي الإجمالي). راجع البنود قبل الاعتماد.';
  END IF;
  IF ROUND(COALESCE(v_row.deductible_vat_amount,0) + COALESCE(v_row.non_deductible_vat_amount,0),2)
     <> ROUND(COALESCE(v_row.vat_amount,0),2) THEN
    RAISE EXCEPTION 'توزيع الضريبة القابلة/غير القابلة للخصم غير مكتمل. حدد قابلية الخصم ثم أعد المحاولة.';
  END IF;

  -- 3) Approve (AFTER trigger creates the journal entry with the corrected amounts).
  v_target := CASE
    WHEN COALESCE(v_row.paid_amount,0) <= 0 THEN 'approved'
    WHEN v_row.paid_amount < v_row.total_amount THEN 'partially_paid'
    ELSE 'paid'
  END::public.purchase_invoice_status;

  UPDATE public.purchase_invoices
     SET status = v_target, approved_by = auth.uid(), approved_at = now(), reviewed_by = auth.uid()
   WHERE id = p_invoice_id
   RETURNING * INTO v_row;

  -- 4) Verify the approval journal entry is complete and balanced; otherwise roll back everything.
  IF public.acct_should_post(v_row.issue_date) THEN
    SELECT id INTO v_je FROM public.journal_entries
      WHERE source_type = 'purchase_invoice_approval'
        AND source_id = v_row.id::text
        AND status <> 'reversed'
      ORDER BY created_at DESC LIMIT 1;
    IF v_je IS NULL THEN
      RAISE EXCEPTION 'تعذّر إنشاء القيد المحاسبي للاعتماد. تم التراجع عن العملية.';
    END IF;
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO v_debit, v_credit
      FROM public.journal_entry_lines WHERE journal_entry_id = v_je;
    IF v_debit <= 0 OR ROUND(v_debit,2) <> ROUND(v_credit,2) THEN
      RAISE EXCEPTION 'القيد المحاسبي غير متوازن (مدين % / دائن %). تم التراجع عن الاعتماد.', v_debit, v_credit;
    END IF;
    IF COALESCE(v_row.deductible_vat_amount,0) > 0
       AND NOT EXISTS (SELECT 1 FROM public.journal_entry_lines
                        WHERE journal_entry_id = v_je
                          AND account_id = public.acct_id('input_vat_deductible')
                          AND debit > 0) THEN
      RAISE EXCEPTION 'لم تُسجل الضريبة القابلة للخصم في حساب ضريبة المدخلات. تم التراجع عن الاعتماد.';
    END IF;
  END IF;

  RETURN v_row;
END $function$;

-- Read-only diagnostic: approved gateway-fee invoices whose journal entry does not match.
CREATE OR REPLACE FUNCTION public.finance_provider_fee_posting_mismatches()
 RETURNS TABLE (
   invoice_id bigint,
   internal_reference text,
   issue_date date,
   total_amount numeric,
   vat_amount numeric,
   deductible_vat_amount numeric,
   journal_entry_id uuid,
   je_debit numeric,
   je_credit numeric,
   je_input_vat numeric,
   issue text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  WITH je AS (
    SELECT j.id, j.source_id,
           COALESCE(SUM(l.debit),0) AS d,
           COALESCE(SUM(l.credit),0) AS c,
           COALESCE(SUM(l.debit) FILTER (WHERE l.account_id = public.acct_id('input_vat_deductible')),0) AS ivat
      FROM public.journal_entries j
      LEFT JOIN public.journal_entry_lines l ON l.journal_entry_id = j.id
     WHERE j.source_type = 'purchase_invoice_approval' AND j.status <> 'reversed'
     GROUP BY j.id, j.source_id
  )
  SELECT p.id, p.internal_reference, p.issue_date, p.total_amount, p.vat_amount,
         p.deductible_vat_amount, je.id, je.d, je.c, je.ivat,
         CASE
           WHEN je.id IS NULL THEN 'لا يوجد قيد اعتماد'
           WHEN ROUND(je.d,2) <> ROUND(je.c,2) THEN 'قيد غير متوازن'
           WHEN ROUND(je.c,2) <> ROUND(p.total_amount,2) THEN 'إجمالي القيد لا يطابق الفاتورة'
           WHEN ROUND(je.ivat,2) <> ROUND(COALESCE(p.deductible_vat_amount,0),2) THEN 'ضريبة المدخلات لا تطابق الفاتورة'
           ELSE 'غير معروف'
         END
    FROM public.purchase_invoices p
    LEFT JOIN je ON je.source_id = p.id::text
   WHERE p.payment_provider_id IS NOT NULL
     AND p.status IN ('approved','partially_paid','paid')
     AND (private.has_role(auth.uid(),'admin')
          OR private.has_role(auth.uid(),'finance_manage')
          OR private.has_role(auth.uid(),'finance_accountant'))
     AND (
       je.id IS NULL
       OR ROUND(je.d,2) <> ROUND(je.c,2)
       OR ROUND(je.c,2) <> ROUND(p.total_amount,2)
       OR ROUND(je.ivat,2) <> ROUND(COALESCE(p.deductible_vat_amount,0),2)
     )
   ORDER BY p.issue_date DESC;
$function$;

REVOKE ALL ON FUNCTION public.finance_provider_fee_posting_mismatches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_provider_fee_posting_mismatches() TO authenticated;