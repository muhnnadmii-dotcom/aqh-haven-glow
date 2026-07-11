-- 1) Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='credit_debit_note_type') THEN
    CREATE TYPE public.credit_debit_note_type AS ENUM
      ('sales_credit_note','sales_debit_note','purchase_credit_note','purchase_debit_note');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='credit_debit_note_status') THEN
    CREATE TYPE public.credit_debit_note_status AS ENUM ('draft','approved','cancelled');
  END IF;
END $$;

-- 2) Sequence for numbering
CREATE SEQUENCE IF NOT EXISTS public.credit_debit_notes_number_seq;

-- 3) Table
CREATE TABLE IF NOT EXISTS public.credit_debit_notes (
  id bigserial PRIMARY KEY,
  note_number text NOT NULL UNIQUE,
  note_type public.credit_debit_note_type NOT NULL,
  -- Exactly one of the two invoice FKs is set (enforced by CHECK below)
  original_sales_invoice_id bigint REFERENCES public.sales_invoices(id) ON DELETE RESTRICT,
  original_purchase_invoice_id bigint REFERENCES public.purchase_invoices(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  status public.credit_debit_note_status NOT NULL DEFAULT 'draft',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  overage_override_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  reversing_journal_entry_id uuid,
  created_by uuid DEFAULT auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cdn_link_matches_type CHECK (
    (note_type IN ('sales_credit_note','sales_debit_note')
      AND original_sales_invoice_id IS NOT NULL
      AND original_purchase_invoice_id IS NULL)
    OR
    (note_type IN ('purchase_credit_note','purchase_debit_note')
      AND original_purchase_invoice_id IS NOT NULL
      AND original_sales_invoice_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_cdn_sales_original ON public.credit_debit_notes(original_sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cdn_purchase_original ON public.credit_debit_notes(original_purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cdn_type_status ON public.credit_debit_notes(note_type, status);
CREATE INDEX IF NOT EXISTS idx_cdn_issue_date ON public.credit_debit_notes(issue_date);

GRANT SELECT, INSERT, UPDATE ON public.credit_debit_notes TO authenticated;
GRANT USAGE ON SEQUENCE public.credit_debit_notes_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.credit_debit_notes_number_seq TO authenticated;
GRANT ALL ON public.credit_debit_notes TO service_role;
ALTER TABLE public.credit_debit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cdn_select ON public.credit_debit_notes;
CREATE POLICY cdn_select ON public.credit_debit_notes FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));

DROP POLICY IF EXISTS cdn_insert ON public.credit_debit_notes;
CREATE POLICY cdn_insert ON public.credit_debit_notes FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin')
           OR private.has_role(auth.uid(),'finance_manage')
           OR private.has_role(auth.uid(),'finance_accountant'));

DROP POLICY IF EXISTS cdn_update ON public.credit_debit_notes;
CREATE POLICY cdn_update ON public.credit_debit_notes FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')
      OR private.has_role(auth.uid(),'finance_manage')
      OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin')
           OR private.has_role(auth.uid(),'finance_manage')
           OR private.has_role(auth.uid(),'finance_accountant'));

-- 4) Items
CREATE TABLE IF NOT EXISTS public.credit_debit_note_items (
  id bigserial PRIMARY KEY,
  note_id bigint NOT NULL REFERENCES public.credit_debit_notes(id) ON DELETE CASCADE,
  original_invoice_item_id bigint,
  description text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  tax_code public.sales_invoice_tax_code NOT NULL DEFAULT 'standard_15',
  tax_rate numeric(6,3) NOT NULL DEFAULT 15,
  line_subtotal numeric(14,2) NOT NULL DEFAULT 0,
  line_tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cdn_items_note ON public.credit_debit_note_items(note_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_debit_note_items TO authenticated;
GRANT USAGE ON SEQUENCE public.credit_debit_note_items_id_seq TO authenticated;
GRANT ALL ON public.credit_debit_note_items TO service_role;
ALTER TABLE public.credit_debit_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cdn_items_select ON public.credit_debit_note_items;
CREATE POLICY cdn_items_select ON public.credit_debit_note_items FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));

DROP POLICY IF EXISTS cdn_items_write ON public.credit_debit_note_items;
CREATE POLICY cdn_items_write ON public.credit_debit_note_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')
      OR private.has_role(auth.uid(),'finance_manage')
      OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin')
           OR private.has_role(auth.uid(),'finance_manage')
           OR private.has_role(auth.uid(),'finance_accountant'));

-- 5) Numbering
CREATE OR REPLACE FUNCTION public.next_credit_debit_note_number(p_type public.credit_debit_note_type)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(now(),'YYYY');
  v_prefix text := CASE p_type
    WHEN 'sales_credit_note' THEN 'CN-S'
    WHEN 'sales_debit_note' THEN 'DN-S'
    WHEN 'purchase_credit_note' THEN 'CN-P'
    WHEN 'purchase_debit_note' THEN 'DN-P'
  END;
  v_num bigint; v_candidate text;
BEGIN
  LOOP
    v_num := nextval('public.credit_debit_notes_number_seq');
    v_candidate := v_prefix || '-' || v_year || '-' || lpad(v_num::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.credit_debit_notes WHERE note_number = v_candidate);
  END LOOP;
  RETURN v_candidate;
END $$;
REVOKE ALL ON FUNCTION public.next_credit_debit_note_number(public.credit_debit_note_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_credit_debit_note_number(public.credit_debit_note_type) TO authenticated;

-- 6) Item compute trigger
CREATE OR REPLACE FUNCTION public.cdn_items_compute()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_base numeric(14,2);
BEGIN
  v_base := ROUND(COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0), 2);
  NEW.line_subtotal := GREATEST(v_base, 0);
  IF NEW.tax_code = 'standard_15' THEN NEW.tax_rate := 15; ELSE NEW.tax_rate := 0; END IF;
  NEW.line_tax_amount := ROUND(NEW.line_subtotal * NEW.tax_rate / 100.0, 2);
  NEW.line_total := NEW.line_subtotal + NEW.line_tax_amount;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cdn_items_compute_biu ON public.credit_debit_note_items;
CREATE TRIGGER cdn_items_compute_biu BEFORE INSERT OR UPDATE ON public.credit_debit_note_items
  FOR EACH ROW EXECUTE FUNCTION public.cdn_items_compute();

-- 7) Header recalc + guard triggers
CREATE OR REPLACE FUNCTION public.cdn_recalc_totals(p_note_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub numeric(14,2); v_vat numeric(14,2); v_total numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(line_subtotal),0), COALESCE(SUM(line_tax_amount),0), COALESCE(SUM(line_total),0)
    INTO v_sub, v_vat, v_total
    FROM public.credit_debit_note_items WHERE note_id = p_note_id;
  UPDATE public.credit_debit_notes
    SET subtotal = v_sub, vat_amount = v_vat, total_amount = v_total
    WHERE id = p_note_id;
END $$;

CREATE OR REPLACE FUNCTION public.cdn_items_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM public.cdn_recalc_totals(OLD.note_id); RETURN OLD;
  ELSE
    PERFORM public.cdn_recalc_totals(NEW.note_id);
    IF TG_OP='UPDATE' AND NEW.note_id <> OLD.note_id THEN
      PERFORM public.cdn_recalc_totals(OLD.note_id);
    END IF;
    RETURN NEW;
  END IF;
END $$;
DROP TRIGGER IF EXISTS cdn_items_after_aiud ON public.credit_debit_note_items;
CREATE TRIGGER cdn_items_after_aiud AFTER INSERT OR DELETE OR UPDATE ON public.credit_debit_note_items
  FOR EACH ROW EXECUTE FUNCTION public.cdn_items_after_change();

-- Guard: items only editable while note is draft
CREATE OR REPLACE FUNCTION public.cdn_items_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.credit_debit_note_status;
BEGIN
  IF TG_OP='DELETE' THEN
    SELECT status INTO v_status FROM public.credit_debit_notes WHERE id = OLD.note_id;
    IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'لا يمكن تعديل بنود إشعار غير مسودة'; END IF;
    RETURN OLD;
  ELSE
    SELECT status INTO v_status FROM public.credit_debit_notes WHERE id = NEW.note_id;
    IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'لا يمكن تعديل بنود إشعار غير مسودة'; END IF;
    RETURN NEW;
  END IF;
END $$;
DROP TRIGGER IF EXISTS cdn_items_guard_biud ON public.credit_debit_note_items;
CREATE TRIGGER cdn_items_guard_biud BEFORE INSERT OR DELETE OR UPDATE ON public.credit_debit_note_items
  FOR EACH ROW EXECUTE FUNCTION public.cdn_items_guard();

DROP TRIGGER IF EXISTS cdn_touch ON public.credit_debit_notes;
CREATE TRIGGER cdn_touch BEFORE UPDATE ON public.credit_debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8) Header guard: freeze fields once approved; auto-number on insert
CREATE OR REPLACE FUNCTION public.cdn_header_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.note_number IS NULL OR NEW.note_number = '' THEN
      NEW.note_number := public.next_credit_debit_note_number(NEW.note_type);
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE
  IF OLD.status = 'approved' AND NEW.status = 'approved' THEN
    -- Freeze commercial fields; allow only cancellation-related updates
    NEW.note_number := OLD.note_number;
    NEW.note_type := OLD.note_type;
    NEW.original_sales_invoice_id := OLD.original_sales_invoice_id;
    NEW.original_purchase_invoice_id := OLD.original_purchase_invoice_id;
    NEW.customer_id := OLD.customer_id;
    NEW.supplier_id := OLD.supplier_id;
    NEW.issue_date := OLD.issue_date;
    NEW.subtotal := OLD.subtotal;
    NEW.vat_amount := OLD.vat_amount;
    NEW.total_amount := OLD.total_amount;
    NEW.reason := OLD.reason;
  END IF;
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'الإشعار الملغى لا يمكن تعديله';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cdn_header_guard_biu ON public.credit_debit_notes;
CREATE TRIGGER cdn_header_guard_biu BEFORE INSERT OR UPDATE ON public.credit_debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.cdn_header_guard();

-- 9) Approve RPC — creates a single journal entry (idempotent)
CREATE OR REPLACE FUNCTION public.approve_credit_debit_note(p_note_id bigint, p_override_reason text DEFAULT NULL)
RETURNS public.credit_debit_notes
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private
AS $$
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
  IF NOT FOUND THEN RAISE EXCEPTION 'note not found'; END IF;
  IF v.status = 'approved' THEN RETURN v; END IF;
  IF v.status = 'cancelled' THEN RAISE EXCEPTION 'الإشعار ملغى'; END IF;
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

  -- Idempotency guard on journal entry
  IF EXISTS (SELECT 1 FROM public.journal_entries
             WHERE source_type='credit_debit_note_approval' AND source_id = v.id::text AND status <> 'reversed') THEN
    -- Journal already posted; just flip status
    UPDATE public.credit_debit_notes
      SET status='approved', approved_by=v_actor, approved_at=now()
      WHERE id = v.id RETURNING * INTO v;
    RETURN v;
  END IF;

  -- Post journal entry only if auto-post allowed for the note date
  IF public.acct_should_post(v.issue_date) THEN
    INSERT INTO public.journal_entries(entry_date, description, source_type, source_id, status)
    VALUES (v.issue_date,
            'اعتماد ' || v.note_number,
            'credit_debit_note_approval', v.id::text, 'draft')
    RETURNING id INTO v_je;

    IF v.note_type = 'sales_credit_note' THEN
      -- Reduce sales & output VAT; reduce AR
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
      VALUES (v_je, public.acct_id('sales_revenue'), 'تخفيض مبيعات - ' || v.note_number, v.subtotal, 0, v.customer_id, 1);
      IF v.vat_amount > 0 THEN
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, line_order)
        VALUES (v_je, public.acct_id('output_vat_payable'), 'تخفيض ضريبة مخرجات', v.vat_amount, 0, 2);
      END IF;
      INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
      VALUES (v_je, public.acct_id('accounts_receivable'), 'تخفيض ذمة عميل', 0, v.total_amount, v.customer_id, 3);

    ELSIF v.note_type = 'sales_debit_note' THEN
      -- Increase sales & output VAT; increase AR
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
        -- Reduce: Dr AP, Cr expense, Cr input VAT (deductible), Cr non_deductible_vat_expense
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
        -- purchase_debit_note: Increase
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

  INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, note, changed_by)
  VALUES ('credit_debit_notes', v.id, 'approve', v.note_number, v_actor);

  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.approve_credit_debit_note(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_credit_debit_note(bigint, text) TO authenticated;

-- 10) Cancel RPC — creates a reversing journal entry (idempotent on already-cancelled)
CREATE OR REPLACE FUNCTION public.cancel_credit_debit_note(p_note_id bigint, p_reason text)
RETURNS public.credit_debit_notes
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private
AS $$
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
  IF NOT FOUND THEN RAISE EXCEPTION 'note not found'; END IF;
  IF v.status = 'cancelled' THEN RETURN v; END IF;

  IF v.status = 'draft' THEN
    UPDATE public.credit_debit_notes
      SET status='cancelled', cancelled_at=now(), cancelled_by=v_actor, cancel_reason=p_reason
      WHERE id = v.id RETURNING * INTO v;
    INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, note, changed_by)
    VALUES ('credit_debit_notes', v.id, 'cancel_draft', p_reason, v_actor);
    RETURN v;
  END IF;

  -- Approved → create reversing JE
  SELECT id INTO v_orig_je FROM public.journal_entries
    WHERE source_type='credit_debit_note_approval' AND source_id = v.id::text AND status='posted'
    ORDER BY created_at DESC LIMIT 1;

  IF v_orig_je IS NOT NULL AND v.reversing_journal_entry_id IS NULL THEN
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
        cancel_reason=p_reason, reversing_journal_entry_id=v_new_je
    WHERE id = v.id RETURNING * INTO v;

  INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, note, changed_by)
  VALUES ('credit_debit_notes', v.id, 'cancel_approved', p_reason, v_actor);

  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.cancel_credit_debit_note(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_credit_debit_note(bigint, text) TO authenticated;

-- 11) Extend VAT period summary to include approved notes
CREATE OR REPLACE FUNCTION public.vat_get_period_summary(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, private
AS $$
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
  -- Notes deltas
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
    COALESCE(SUM(pi.taxable_amount),0),
    COALESCE(SUM(pi.vat_amount),0),
    COALESCE(SUM(pi.deductible_vat_amount),0),
    COALESCE(SUM(pi.non_deductible_vat_amount),0)
  INTO v_std_purch, v_input_vat, v_deductible, v_nondeductible
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  SELECT
    COALESCE(SUM(CASE WHEN it.tax_code='zero_rated' THEN it.line_subtotal END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='exempt' THEN it.line_subtotal END),0)
  INTO v_zero_purch, v_exempt_purch
  FROM public.purchase_invoices pi
  JOIN public.purchase_invoice_items it ON it.purchase_invoice_id = pi.id
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

  -- Apply deltas
  v_std_sales := v_std_sales + v_sales_note_taxable;
  v_output_vat := v_output_vat + v_sales_note_vat;
  v_std_purch := v_std_purch + v_purch_note_taxable;
  v_input_vat := v_input_vat + v_purch_note_vat;
  v_deductible := v_deductible + v_purch_note_ded;
  v_nondeductible := v_nondeductible + v_purch_note_nd;

  SELECT COUNT(*) INTO v_pending_review FROM public.purchase_invoices pi
    WHERE pi.status IN ('under_review','draft')
      AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  SELECT COUNT(*) INTO v_missing_att FROM public.purchase_invoices pi
    WHERE pi.status IN ('approved','partially_paid','paid')
      AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
      AND pi.attachment_required = true
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
END $$;