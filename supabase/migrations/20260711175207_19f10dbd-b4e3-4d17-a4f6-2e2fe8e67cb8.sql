
-- =====================================================
-- PURCHASE INVOICES MODULE
-- =====================================================

-- 1. Enums
CREATE TYPE public.purchase_type AS ENUM (
  'operating_expense','inventory','asset','service','government_fee','other'
);

CREATE TYPE public.purchase_invoice_status AS ENUM (
  'draft','under_review','approved','rejected','partially_paid','paid'
);

CREATE TYPE public.purchase_payment_status AS ENUM (
  'unpaid','partially_paid','paid','overpaid'
);

CREATE TYPE public.purchase_vat_deductibility AS ENUM (
  'fully_deductible','partially_deductible','non_deductible','pending_review'
);

CREATE TYPE public.purchase_non_deductible_reason AS ENUM (
  'missing_tax_invoice','invalid_supplier_tax_data','personal_expense',
  'unrelated_to_business','exempt_activity','duplicate_invoice',
  'outside_tax_period','restricted_expense','other'
);

CREATE TYPE public.purchase_payment_type AS ENUM (
  'supplier_invoice_payment','direct_expense','inventory_payment',
  'asset_payment','owner_reimbursement','other'
);

-- 2. Sequence for internal reference
CREATE SEQUENCE public.purchase_invoices_number_seq;

-- 3. purchase_invoices
CREATE TABLE public.purchase_invoices (
  id BIGSERIAL PRIMARY KEY,
  supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  supplier_invoice_number text,
  internal_reference text NOT NULL UNIQUE,
  issue_date date NOT NULL DEFAULT current_date,
  supply_date date,
  due_date date,
  purchase_type public.purchase_type NOT NULL DEFAULT 'operating_expense',
  status public.purchase_invoice_status NOT NULL DEFAULT 'draft',
  payment_status public.purchase_payment_status NOT NULL DEFAULT 'unpaid',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  taxable_amount numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  deductible_vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  non_deductible_vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(14,2) NOT NULL DEFAULT 0,
  vat_deductibility public.purchase_vat_deductibility NOT NULL DEFAULT 'fully_deductible',
  deductible_percentage numeric(6,3) NOT NULL DEFAULT 100 CHECK (deductible_percentage >= 0 AND deductible_percentage <= 100),
  non_deductible_reason public.purchase_non_deductible_reason,
  reviewer_note text,
  attachment_required boolean NOT NULL DEFAULT true,
  attachment_exception_reason text,
  paid_from_personal_account boolean NOT NULL DEFAULT false,
  duplicate_override_reason text,
  notes text,
  internal_notes text,
  currency text NOT NULL DEFAULT 'SAR',
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_invoices_supplier ON public.purchase_invoices(supplier_id);
CREATE INDEX idx_purchase_invoices_status ON public.purchase_invoices(status);
CREATE INDEX idx_purchase_invoices_payment_status ON public.purchase_invoices(payment_status);
CREATE INDEX idx_purchase_invoices_issue_date ON public.purchase_invoices(issue_date DESC);
CREATE INDEX idx_purchase_invoices_vat_ded ON public.purchase_invoices(vat_deductibility);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoices TO authenticated;
GRANT ALL ON public.purchase_invoices TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.purchase_invoices_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.purchase_invoices_number_seq TO authenticated;

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchase_invoices_read ON public.purchase_invoices FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_any_finance_role(auth.uid()));
CREATE POLICY purchase_invoices_write ON public.purchase_invoices FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));
CREATE POLICY purchase_invoices_update ON public.purchase_invoices FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));
CREATE POLICY purchase_invoices_delete ON public.purchase_invoices FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

-- 4. purchase_invoice_items
CREATE TABLE public.purchase_invoice_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_invoice_id bigint NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  expense_category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  product_id bigint REFERENCES public.aqh_products(id) ON DELETE SET NULL,
  tax_code public.sales_invoice_tax_code NOT NULL DEFAULT 'standard_15',
  tax_rate numeric(6,3) NOT NULL DEFAULT 15,
  line_subtotal numeric(14,2) NOT NULL DEFAULT 0,
  line_tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_invoice_items_invoice ON public.purchase_invoice_items(purchase_invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoice_items TO authenticated;
GRANT ALL ON public.purchase_invoice_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.purchase_invoice_items_id_seq TO authenticated;

ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchase_invoice_items_read ON public.purchase_invoice_items FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_any_finance_role(auth.uid()));
CREATE POLICY purchase_invoice_items_write ON public.purchase_invoice_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));

-- 5. Numbering function
CREATE OR REPLACE FUNCTION public.next_purchase_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year text := to_char(now(),'YYYY');
  v_num bigint;
  v_candidate text;
BEGIN
  LOOP
    v_num := nextval('public.purchase_invoices_number_seq');
    v_candidate := 'PUR-' || v_year || '-' || lpad(v_num::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.purchase_invoices WHERE internal_reference = v_candidate);
  END LOOP;
  RETURN v_candidate;
END $$;

-- 6. Line item compute
CREATE OR REPLACE FUNCTION public.purchase_invoice_items_compute()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_base numeric(14,2);
BEGIN
  v_base := ROUND(COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0), 2);
  NEW.line_subtotal := GREATEST(v_base - COALESCE(NEW.discount_amount,0), 0);
  IF NEW.tax_code = 'standard_15' THEN NEW.tax_rate := 15;
  ELSE NEW.tax_rate := 0;
  END IF;
  NEW.line_tax_amount := ROUND(NEW.line_subtotal * NEW.tax_rate / 100.0, 2);
  NEW.line_total := NEW.line_subtotal + NEW.line_tax_amount;
  RETURN NEW;
END $$;

-- 7. Invoice totals recalc
CREATE OR REPLACE FUNCTION public.purchase_invoice_recalc_totals(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub numeric(14,2) := 0;
  v_disc numeric(14,2) := 0;
  v_taxable numeric(14,2) := 0;
  v_vat numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_paid numeric(14,2) := 0;
  v_ded_pct numeric(6,3);
  v_ded numeric(14,2);
  v_nondec numeric(14,2);
  v_vat_ded public.purchase_vat_deductibility;
  v_current public.purchase_invoice_status;
BEGIN
  SELECT
    COALESCE(SUM(ROUND(quantity*unit_price,2)),0),
    COALESCE(SUM(discount_amount),0),
    COALESCE(SUM(line_subtotal),0),
    COALESCE(SUM(line_tax_amount),0),
    COALESCE(SUM(line_total),0)
  INTO v_sub, v_disc, v_taxable, v_vat, v_total
  FROM public.purchase_invoice_items WHERE purchase_invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount),0) INTO v_paid
  FROM public.finance_expenses
  WHERE purchase_invoice_id = p_invoice_id AND deleted_at IS NULL;

  SELECT vat_deductibility, deductible_percentage, status
    INTO v_vat_ded, v_ded_pct, v_current
    FROM public.purchase_invoices WHERE id = p_invoice_id;

  IF v_vat_ded = 'fully_deductible' THEN
    v_ded := v_vat; v_nondec := 0;
  ELSIF v_vat_ded = 'non_deductible' THEN
    v_ded := 0; v_nondec := v_vat;
  ELSIF v_vat_ded = 'partially_deductible' THEN
    v_ded := ROUND(v_vat * COALESCE(v_ded_pct,0) / 100.0, 2);
    v_nondec := v_vat - v_ded;
  ELSE -- pending_review
    v_ded := 0; v_nondec := 0;
  END IF;

  UPDATE public.purchase_invoices SET
    subtotal = v_sub,
    discount_amount = v_disc,
    taxable_amount = v_taxable,
    vat_amount = v_vat,
    deductible_vat_amount = v_ded,
    non_deductible_vat_amount = v_nondec,
    total_amount = v_total,
    paid_amount = v_paid,
    remaining_amount = GREATEST(v_total - v_paid, 0),
    payment_status = CASE
      WHEN v_paid <= 0 THEN 'unpaid'::public.purchase_payment_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.purchase_payment_status
      WHEN v_paid = v_total THEN 'paid'::public.purchase_payment_status
      ELSE 'overpaid'::public.purchase_payment_status
    END,
    status = CASE
      WHEN v_current IN ('draft','under_review','rejected') THEN v_current
      WHEN v_paid <= 0 THEN 'approved'::public.purchase_invoice_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.purchase_invoice_status
      WHEN v_paid >= v_total THEN 'paid'::public.purchase_invoice_status
      ELSE v_current
    END
  WHERE id = p_invoice_id;
END $$;

-- 8. Items after change trigger
CREATE OR REPLACE FUNCTION public.purchase_invoice_items_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM public.purchase_invoice_recalc_totals(OLD.purchase_invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.purchase_invoice_recalc_totals(NEW.purchase_invoice_id);
    IF TG_OP='UPDATE' AND NEW.purchase_invoice_id <> OLD.purchase_invoice_id THEN
      PERFORM public.purchase_invoice_recalc_totals(OLD.purchase_invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END $$;

-- 9. Items guard (block edits on non-draft)
CREATE OR REPLACE FUNCTION public.purchase_invoice_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_status public.purchase_invoice_status;
BEGIN
  IF TG_OP='DELETE' THEN
    SELECT status INTO v_status FROM public.purchase_invoices WHERE id = OLD.purchase_invoice_id;
    IF v_status NOT IN ('draft','under_review','rejected') THEN
      RAISE EXCEPTION 'لا يمكن تعديل بنود فاتورة مشتريات معتمدة';
    END IF;
    RETURN OLD;
  ELSE
    SELECT status INTO v_status FROM public.purchase_invoices WHERE id = NEW.purchase_invoice_id;
    IF v_status NOT IN ('draft','under_review','rejected') THEN
      RAISE EXCEPTION 'لا يمكن تعديل بنود فاتورة مشتريات معتمدة';
    END IF;
    RETURN NEW;
  END IF;
END $$;

-- 10. Invoice guard: numbering + freeze + duplicate + validations
CREATE OR REPLACE FUNCTION public.purchase_invoices_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
DECLARE v_dup int;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status NOT IN ('draft','rejected') THEN
      RAISE EXCEPTION 'لا يمكن حذف فاتورة مشتريات ليست مسودة أو مرفوضة';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP='INSERT' AND (NEW.internal_reference IS NULL OR NEW.internal_reference = '') THEN
    NEW.internal_reference := public.next_purchase_invoice_number();
  END IF;

  -- vat_deductibility validations
  IF NEW.vat_deductibility = 'partially_deductible'
     AND (NEW.deductible_percentage IS NULL OR NEW.deductible_percentage <= 0 OR NEW.deductible_percentage >= 100) THEN
    RAISE EXCEPTION 'يجب إدخال نسبة خصم بين 0 و 100 للفواتير القابلة للخصم جزئيًا';
  END IF;
  IF NEW.vat_deductibility = 'non_deductible' AND NEW.non_deductible_reason IS NULL THEN
    RAISE EXCEPTION 'يجب اختيار سبب عدم خصم الضريبة';
  END IF;

  -- Freeze commercial fields once approved
  IF TG_OP='UPDATE'
     AND OLD.status IN ('approved','partially_paid','paid')
     AND NEW.status NOT IN ('rejected') THEN
    NEW.internal_reference := OLD.internal_reference;
    NEW.supplier_id := OLD.supplier_id;
    NEW.supplier_invoice_number := OLD.supplier_invoice_number;
    NEW.issue_date := OLD.issue_date;
    NEW.supply_date := OLD.supply_date;
    NEW.purchase_type := OLD.purchase_type;
    NEW.subtotal := OLD.subtotal;
    NEW.discount_amount := OLD.discount_amount;
    NEW.taxable_amount := OLD.taxable_amount;
    NEW.vat_amount := OLD.vat_amount;
    NEW.total_amount := OLD.total_amount;
    NEW.currency := OLD.currency;
  END IF;

  -- Duplicate supplier invoice number check on transition to under_review/approved
  IF NEW.status IN ('under_review','approved','partially_paid','paid')
     AND NEW.supplier_id IS NOT NULL
     AND NEW.supplier_invoice_number IS NOT NULL
     AND NEW.supplier_invoice_number <> '' THEN
    SELECT count(*) INTO v_dup
    FROM public.purchase_invoices
    WHERE supplier_id = NEW.supplier_id
      AND supplier_invoice_number = NEW.supplier_invoice_number
      AND id <> COALESCE(NEW.id, -1)
      AND status NOT IN ('rejected','draft');
    IF v_dup > 0 AND (NEW.duplicate_override_reason IS NULL OR NEW.duplicate_override_reason = '') THEN
      RAISE EXCEPTION 'رقم فاتورة المورد مكرر لهذا المورد. يجب إدخال سبب تجاوز للاعتماد.';
    END IF;
    IF v_dup > 0
       AND (OLD.duplicate_override_reason IS NULL OR OLD.duplicate_override_reason = '')
       AND NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
      RAISE EXCEPTION 'فقط المدير يمكنه تجاوز تكرار رقم الفاتورة';
    END IF;
  END IF;

  -- Attachment required check
  IF NEW.status IN ('under_review','approved','partially_paid','paid')
     AND NEW.attachment_required
     AND (NEW.attachment_exception_reason IS NULL OR NEW.attachment_exception_reason = '')
     AND NOT EXISTS (
       SELECT 1 FROM public.finance_attachments
       WHERE related_type = 'purchase_invoice'
         AND related_bigint_id = NEW.id
     )
  THEN
    -- Only enforce on UPDATE transitioning (allow INSERT draft)
    IF TG_OP='UPDATE' AND OLD.status = 'draft' THEN
      RAISE EXCEPTION 'يلزم إرفاق مستند أو إدخال سبب استثناء قبل الاعتماد';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- 11. Alter finance_attachments to support bigint related ids and add purchase_invoice type
ALTER TYPE public.finance_related_type ADD VALUE IF NOT EXISTS 'purchase_invoice';
ALTER TABLE public.finance_attachments ADD COLUMN IF NOT EXISTS related_bigint_id bigint;
CREATE INDEX IF NOT EXISTS idx_finance_attachments_related_bigint ON public.finance_attachments(related_type, related_bigint_id);

-- 12. Alter finance_expenses to link purchase invoice + payment_type
ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS purchase_invoice_id bigint REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_type public.purchase_payment_type,
  ADD COLUMN IF NOT EXISTS missing_purchase_invoice_reason text;

CREATE INDEX IF NOT EXISTS idx_finance_expenses_purchase_invoice ON public.finance_expenses(purchase_invoice_id) WHERE purchase_invoice_id IS NOT NULL;

-- 13. Expenses after change: recalc linked purchase invoice
CREATE OR REPLACE FUNCTION public.finance_expenses_after_purchase_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.purchase_invoice_id IS NOT NULL THEN
      PERFORM public.purchase_invoice_recalc_totals(NEW.purchase_invoice_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.purchase_invoice_id IS DISTINCT FROM OLD.purchase_invoice_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      IF OLD.purchase_invoice_id IS NOT NULL THEN
        PERFORM public.purchase_invoice_recalc_totals(OLD.purchase_invoice_id);
      END IF;
      IF NEW.purchase_invoice_id IS NOT NULL AND NEW.purchase_invoice_id IS DISTINCT FROM OLD.purchase_invoice_id THEN
        PERFORM public.purchase_invoice_recalc_totals(NEW.purchase_invoice_id);
      ELSIF NEW.purchase_invoice_id IS NOT NULL THEN
        PERFORM public.purchase_invoice_recalc_totals(NEW.purchase_invoice_id);
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.purchase_invoice_id IS NOT NULL THEN
      PERFORM public.purchase_invoice_recalc_totals(OLD.purchase_invoice_id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

-- 14. Audit trigger (uses related_type='purchase_invoices' and related_bigint_id) — add column to store bigint audit id? We reuse note field.
ALTER TABLE public.finance_audit_logs ADD COLUMN IF NOT EXISTS related_bigint_id bigint;

CREATE OR REPLACE FUNCTION public.purchase_invoices_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  k text; ov text; nv text;
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, changed_by)
    VALUES ('purchase_invoices', NEW.id, 'create', v_actor);
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, changed_by)
    VALUES ('purchase_invoices', OLD.id, 'delete', v_actor);
    RETURN OLD;
  ELSIF TG_OP='UPDATE' THEN
    FOR k IN SELECT key FROM jsonb_each_text(to_jsonb(NEW)) LOOP
      ov := (to_jsonb(OLD) ->> k);
      nv := (to_jsonb(NEW) ->> k);
      IF ov IS DISTINCT FROM nv AND k NOT IN ('updated_at','created_at') THEN
        INSERT INTO public.finance_audit_logs(related_type, related_bigint_id, action, field_name, old_value, new_value, changed_by)
        VALUES ('purchase_invoices', NEW.id, 'update', k, ov, nv, v_actor);
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

-- 15. Approve function
CREATE OR REPLACE FUNCTION public.approve_purchase_invoice(p_invoice_id bigint)
RETURNS public.purchase_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
DECLARE v_row public.purchase_invoices;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
          OR private.has_role(auth.uid(),'finance_manage')
          OR private.has_role(auth.uid(),'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_row FROM public.purchase_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice not found'; END IF;
  IF v_row.status IN ('approved','partially_paid','paid') THEN
    RETURN v_row;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.purchase_invoice_items WHERE purchase_invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد فاتورة بدون بنود';
  END IF;

  UPDATE public.purchase_invoices
     SET status='approved', approved_by=auth.uid(), approved_at=now(), reviewed_by=auth.uid()
   WHERE id = p_invoice_id
   RETURNING * INTO v_row;

  PERFORM public.purchase_invoice_recalc_totals(p_invoice_id);
  SELECT * INTO v_row FROM public.purchase_invoices WHERE id = p_invoice_id;
  RETURN v_row;
END $$;

-- 16. Triggers
CREATE TRIGGER purchase_invoices_guard_biud
  BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.purchase_invoices_guard();

CREATE TRIGGER purchase_invoices_touch
  BEFORE UPDATE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER purchase_invoices_audit_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.purchase_invoices_audit();

CREATE TRIGGER purchase_invoice_items_compute_biu
  BEFORE INSERT OR UPDATE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.purchase_invoice_items_compute();

CREATE TRIGGER purchase_invoice_items_guard_biud
  BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.purchase_invoice_items_guard();

CREATE TRIGGER purchase_invoice_items_after_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.purchase_invoice_items_after_change();

CREATE TRIGGER purchase_invoice_items_touch
  BEFORE UPDATE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER finance_expenses_after_purchase_link_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_expenses_after_purchase_link();
