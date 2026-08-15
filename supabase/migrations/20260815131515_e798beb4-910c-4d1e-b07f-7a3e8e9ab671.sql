CREATE OR REPLACE FUNCTION public.approve_credit_debit_note(p_note_id bigint, p_override_reason text DEFAULT NULL::text)
 RETURNS credit_debit_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v public.credit_debit_notes;
  v_actor uuid := auth.uid();
  v_sales public.sales_invoices;
  v_purch public.purchase_invoices;
  v_je uuid;
  v_expense_key text;
  v_deductible numeric(14,2);
  v_nondeductible numeric(14,2);
  v_ded_pct numeric(6,3);
  v_notes_used numeric(14,2);
  v_available numeric(14,2);
BEGIN
  IF NOT (private.has_role(v_actor,'admin')
       OR private.has_role(v_actor,'finance_manage')
       OR private.has_role(v_actor,'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v FROM public.credit_debit_notes WHERE id = p_note_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإشعار غير موجود'; END IF;
  IF v.status = 'cancelled' THEN RAISE EXCEPTION 'الإشعار ملغى'; END IF;
  IF v.status = 'approved' THEN
    -- idempotent: re-sync linked invoice and return
    PERFORM public.cdn_sync_linked_invoice(v.id);
    SELECT * INTO v FROM public.credit_debit_notes WHERE id = p_note_id;
    RETURN v;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.credit_debit_note_items WHERE note_id = p_note_id) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد إشعار بدون بنود';
  END IF;

  -- Overage check for credit notes (reduce): note total must not exceed remaining
  IF v.note_type IN ('sales_credit_note','purchase_credit_note') THEN
    IF v.note_type = 'sales_credit_note' THEN
      SELECT * INTO v_sales FROM public.sales_invoices WHERE id = v.original_sales_invoice_id;
      SELECT COALESCE(SUM(total_amount),0) INTO v_notes_used
        FROM public.credit_debit_notes
        WHERE original_sales_invoice_id = v.original_sales_invoice_id
          AND note_type='sales_credit_note' AND status='approved' AND id <> v.id;
      v_available := v_sales.total_amount - v_notes_used;
    ELSE
      SELECT * INTO v_purch FROM public.purchase_invoices WHERE id = v.original_purchase_invoice_id;
      SELECT COALESCE(SUM(total_amount),0) INTO v_notes_used
        FROM public.credit_debit_notes
        WHERE original_purchase_invoice_id = v.original_purchase_invoice_id
          AND note_type='purchase_credit_note' AND status='approved' AND id <> v.id;
      v_available := v_purch.total_amount - v_notes_used;
    END IF;

    IF v.total_amount > v_available THEN
      IF (p_override_reason IS NULL OR p_override_reason='')
         AND (v.overage_override_reason IS NULL OR v.overage_override_reason='') THEN
        RAISE EXCEPTION 'قيمة الإشعار الدائن (%) تتجاوز رصيد الفاتورة المتبقي (%). يلزم سبب تجاوز موثق من المدير.',
          v.total_amount, v_available;
      END IF;
      IF NOT (private.has_role(v_actor,'admin') OR private.has_role(v_actor,'finance_manage')) THEN
        RAISE EXCEPTION 'تجاوز رصيد الفاتورة يتطلب صلاحية مدير';
      END IF;
      IF p_override_reason IS NOT NULL AND p_override_reason <> '' THEN
        UPDATE public.credit_debit_notes SET overage_override_reason = p_override_reason WHERE id = v.id;
      END IF;
    END IF;
  END IF;

  -- Post journal entry only if auto-post allowed AND no active journal exists (idempotency)
  IF public.acct_should_post(v.issue_date)
     AND NOT EXISTS (SELECT 1 FROM public.journal_entries
                     WHERE source_type='credit_debit_note_approval'
                       AND source_id = v.id::text AND status <> 'reversed') THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (v.issue_date,
            'اعتماد ' || v.note_number,
            'credit_debit_note_approval', v.id::text, 'draft')
    RETURNING id INTO v_je;

    IF v.note_type = 'sales_credit_note' THEN
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
      VALUES (v_je, public.acct_id('sales_revenue'), 'تخفيض مبيعات - ' || v.note_number, v.subtotal, 0, v.customer_id, 1);
      IF v.vat_amount > 0 THEN
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
        VALUES (v_je, public.acct_id('output_vat_payable'), 'تخفيض ضريبة مخرجات', v.vat_amount, 0, 2);
      END IF;
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
      VALUES (v_je, public.acct_id('accounts_receivable'), 'تخفيض ذمة عميل', 0, v.total_amount, v.customer_id, 3);

    ELSIF v.note_type = 'sales_debit_note' THEN
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
      VALUES (v_je, public.acct_id('accounts_receivable'), 'زيادة ذمة عميل', v.total_amount, 0, v.customer_id, 1);
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
      VALUES (v_je, public.acct_id('sales_revenue'), 'زيادة مبيعات', 0, v.subtotal, v.customer_id, 2);
      IF v.vat_amount > 0 THEN
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
        VALUES (v_je, public.acct_id('output_vat_payable'), 'زيادة ضريبة مخرجات', 0, v.vat_amount, 3);
      END IF;

    ELSIF v.note_type IN ('purchase_credit_note','purchase_debit_note') THEN
      SELECT * INTO v_purch FROM public.purchase_invoices WHERE id = v.original_purchase_invoice_id;
      v_expense_key := CASE v_purch.purchase_type
        WHEN 'inventory' THEN 'inventory'
        WHEN 'asset' THEN 'fixed_assets'
        WHEN 'government_fee' THEN 'government_fees'
        ELSE 'operating_expense'
      END;
      v_ded_pct := COALESCE(v_purch.deductible_percentage, 100);
      v_deductible := ROUND(v.vat_amount * v_ded_pct / 100.0, 2);
      v_nondeductible := v.vat_amount - v_deductible;

      IF v.note_type = 'purchase_credit_note' THEN
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, line_order)
        VALUES (v_je, public.acct_id('accounts_payable'), 'تخفيض ذمة مورد - ' || v.note_number, v.total_amount, 0, v.supplier_id, 1);
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, line_order)
        VALUES (v_je, public.acct_id(v_expense_key), 'تخفيض مصروف/أصل', 0, v.subtotal, v.supplier_id, 2);
        IF v_deductible > 0 THEN
          INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
          VALUES (v_je, public.acct_id('input_vat_deductible'), 'تخفيض ضريبة مدخلات', 0, v_deductible, 3);
        END IF;
        IF v_nondeductible > 0 THEN
          INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
          VALUES (v_je, public.acct_id('non_deductible_vat_expense'), 'تخفيض ضريبة غير قابلة للخصم', 0, v_nondeductible, 4);
        END IF;
      ELSE
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, line_order)
        VALUES (v_je, public.acct_id(v_expense_key), 'زيادة مصروف/أصل', v.subtotal, 0, v.supplier_id, 1);
        IF v_deductible > 0 THEN
          INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
          VALUES (v_je, public.acct_id('input_vat_deductible'), 'زيادة ضريبة مدخلات', v_deductible, 0, 2);
        END IF;
        IF v_nondeductible > 0 THEN
          INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
          VALUES (v_je, public.acct_id('non_deductible_vat_expense'), 'زيادة ضريبة غير قابلة للخصم', v_nondeductible, 3);
        END IF;
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, supplier_id, line_order)
        VALUES (v_je, public.acct_id('accounts_payable'), 'زيادة ذمة مورد - ' || v.note_number, 0, v.total_amount, v.supplier_id, 4);
      END IF;
    END IF;

    UPDATE public.journal_entries SET status='posted' WHERE id = v_je;
  END IF;

  UPDATE public.credit_debit_notes
    SET status='approved', approved_by=v_actor, approved_at=now()
    WHERE id = v.id RETURNING * INTO v;

  -- Recalculate linked invoice balance/status
  PERFORM public.cdn_sync_linked_invoice(v.id);

  IF NOT EXISTS (SELECT 1 FROM public.finance_audit_logs
                 WHERE related_type='credit_debit_notes' AND related_bigint_id=v.id AND action='approve') THEN
    INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, note, changed_by)
    VALUES ('credit_debit_notes', v.id, 'approve', v.note_number, v_actor);
  END IF;

  RETURN v;
END $function$;

CREATE OR REPLACE FUNCTION public.cancel_credit_debit_note(p_note_id bigint, p_reason text)
 RETURNS credit_debit_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v public.credit_debit_notes;
  v_actor uuid := auth.uid();
  v_orig_je uuid;
  v_new_je uuid;
BEGIN
  IF NOT (private.has_role(v_actor,'admin') OR private.has_role(v_actor,'finance_manage')) THEN
    RAISE EXCEPTION 'إلغاء الإشعار يتطلب صلاحية مدير المالية';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason)='' THEN
    RAISE EXCEPTION 'يجب إدخال سبب الإلغاء';
  END IF;

  SELECT * INTO v FROM public.credit_debit_notes WHERE id = p_note_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإشعار غير موجود'; END IF;
  IF v.status = 'cancelled' THEN
    PERFORM public.cdn_sync_linked_invoice(v.id);
    RETURN v;
  END IF;

  IF v.status = 'draft' THEN
    UPDATE public.credit_debit_notes
      SET status='cancelled', cancelled_at=now(), cancelled_by=v_actor, cancel_reason=p_reason
      WHERE id = v.id RETURNING * INTO v;
    INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, note, changed_by)
    VALUES ('credit_debit_notes', v.id, 'cancel_draft', p_reason, v_actor);
    RETURN v;
  END IF;

  -- Approved → create reversing JE exactly once
  SELECT id INTO v_orig_je FROM public.journal_entries
    WHERE source_type='credit_debit_note_approval' AND source_id = v.id::text AND status='posted'
    ORDER BY created_at DESC LIMIT 1;

  IF v_orig_je IS NOT NULL
     AND v.reversing_journal_entry_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.journal_entries
                     WHERE source_type='credit_debit_note_cancel'
                       AND source_id = v.id::text AND status <> 'reversed') THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (CURRENT_DATE, 'إلغاء ' || v.note_number, 'credit_debit_note_cancel', v.id::text, 'draft')
    RETURNING id INTO v_new_je;

    INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, supplier_id, finance_account_id, line_order)
    SELECT v_new_je, account_id, 'عكس - ' || description, credit, debit, customer_id, supplier_id, finance_account_id, line_order
      FROM public.journal_entry_lines WHERE journal_entry_id = v_orig_je
      ORDER BY line_order;

    UPDATE public.journal_entries SET status='posted' WHERE id = v_new_je;
    UPDATE public.journal_entries SET status='reversed' WHERE id = v_orig_je;
  END IF;

  UPDATE public.credit_debit_notes
    SET status='cancelled', cancelled_at=now(), cancelled_by=v_actor,
        cancel_reason=p_reason, reversing_journal_entry_id=COALESCE(v_new_je, reversing_journal_entry_id)
    WHERE id = v.id RETURNING * INTO v;

  -- Restore linked invoice balance/status
  PERFORM public.cdn_sync_linked_invoice(v.id);

  INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, note, changed_by)
  VALUES ('credit_debit_notes', v.id, 'cancel_approved', p_reason, v_actor);

  RETURN v;
END $function$;