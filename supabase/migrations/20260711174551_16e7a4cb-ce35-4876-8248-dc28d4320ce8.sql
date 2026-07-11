
-- ============================================================
-- Sales Invoices Module (Phase 1)
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.sales_invoice_status AS ENUM ('draft','approved','partially_paid','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sales_invoice_payment_status AS ENUM ('unpaid','partially_paid','paid','overpaid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sales_invoice_tax_code AS ENUM ('standard_15','zero_rated','exempt','out_of_scope');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_collection_type AS ENUM ('invoice_collection','cash_sale','advance_payment','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settings: prefix
ALTER TABLE public.aqh_business_settings
  ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'INV';

-- Sequence for invoice numbering (yearly reset handled inside function using MAX lookup fallback)
CREATE SEQUENCE IF NOT EXISTS public.sales_invoices_number_seq START 1;

-- ============================================================
-- sales_invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id bigserial PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT current_date,
  supply_date date,
  due_date date,
  status public.sales_invoice_status NOT NULL DEFAULT 'draft',
  payment_status public.sales_invoice_payment_status NOT NULL DEFAULT 'unpaid',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  taxable_amount numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  notes text,
  internal_notes text,
  created_by uuid DEFAULT auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON public.sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON public.sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_payment_status ON public.sales_invoices(payment_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_invoices TO authenticated;
GRANT ALL ON public.sales_invoices TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sales_invoices_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.sales_invoices_number_seq TO authenticated;

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_invoices_select_finance" ON public.sales_invoices
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_any_finance_role(auth.uid()));

CREATE POLICY "sales_invoices_insert_finance" ON public.sales_invoices
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));

CREATE POLICY "sales_invoices_update_finance" ON public.sales_invoices
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));

CREATE POLICY "sales_invoices_delete_manage" ON public.sales_invoices
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

CREATE TRIGGER sales_invoices_touch BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- sales_invoice_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_invoice_items (
  id bigserial PRIMARY KEY,
  invoice_id bigint NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  product_id bigint REFERENCES public.aqh_products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_code public.sales_invoice_tax_code NOT NULL DEFAULT 'standard_15',
  tax_rate numeric(6,3) NOT NULL DEFAULT 15,
  line_subtotal numeric(14,2) NOT NULL DEFAULT 0,
  line_tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice ON public.sales_invoice_items(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_invoice_items TO authenticated;
GRANT ALL ON public.sales_invoice_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sales_invoice_items_id_seq TO authenticated;

ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_invoice_items_select_finance" ON public.sales_invoice_items
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_any_finance_role(auth.uid()));

CREATE POLICY "sales_invoice_items_write_finance" ON public.sales_invoice_items
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));

CREATE TRIGGER sales_invoice_items_touch BEFORE UPDATE ON public.sales_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Invoice numbering
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_sales_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_prefix text;
  v_year text := to_char(now(),'YYYY');
  v_num bigint;
  v_candidate text;
BEGIN
  SELECT COALESCE(NULLIF(invoice_prefix,''),'INV') INTO v_prefix FROM public.aqh_business_settings LIMIT 1;
  IF v_prefix IS NULL THEN v_prefix := 'INV'; END IF;
  LOOP
    v_num := nextval('public.sales_invoices_number_seq');
    v_candidate := v_prefix || '-' || v_year || '-' || lpad(v_num::text, 4, '0');
    -- ensure uniqueness even if user manually inserted numbers
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sales_invoices WHERE invoice_number = v_candidate);
  END LOOP;
  RETURN v_candidate;
END $fn$;

REVOKE ALL ON FUNCTION public.next_sales_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_sales_invoice_number() TO authenticated;

-- ============================================================
-- Recompute item math
-- ============================================================
CREATE OR REPLACE FUNCTION public.sales_invoice_items_compute()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_base numeric(14,2);
BEGIN
  v_base := ROUND(COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0), 2);
  NEW.line_subtotal := GREATEST(v_base - COALESCE(NEW.discount_amount,0), 0);
  -- Sync tax_rate with tax_code
  IF NEW.tax_code = 'standard_15' THEN NEW.tax_rate := 15;
  ELSE NEW.tax_rate := 0;
  END IF;
  NEW.line_tax_amount := ROUND(NEW.line_subtotal * NEW.tax_rate / 100.0, 2);
  NEW.line_total := NEW.line_subtotal + NEW.line_tax_amount;
  RETURN NEW;
END $fn$;

CREATE TRIGGER sales_invoice_items_compute_biu
  BEFORE INSERT OR UPDATE ON public.sales_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.sales_invoice_items_compute();

-- ============================================================
-- Recalc invoice totals from items
-- ============================================================
CREATE OR REPLACE FUNCTION public.sales_invoice_recalc_totals(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sub numeric(14,2) := 0;
  v_disc numeric(14,2) := 0;
  v_taxable numeric(14,2) := 0;
  v_vat numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_paid numeric(14,2) := 0;
  v_status public.sales_invoice_status;
  v_current_status public.sales_invoice_status;
BEGIN
  SELECT
    COALESCE(SUM(ROUND(quantity*unit_price,2)),0),
    COALESCE(SUM(discount_amount),0),
    COALESCE(SUM(line_subtotal),0),
    COALESCE(SUM(line_tax_amount),0),
    COALESCE(SUM(line_total),0)
  INTO v_sub, v_disc, v_taxable, v_vat, v_total
  FROM public.sales_invoice_items WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount),0) INTO v_paid
  FROM public.finance_incomes
  WHERE sales_invoice_id = p_invoice_id AND deleted_at IS NULL;

  SELECT status INTO v_current_status FROM public.sales_invoices WHERE id = p_invoice_id;

  UPDATE public.sales_invoices SET
    subtotal = v_sub,
    discount_amount = v_disc,
    taxable_amount = v_taxable,
    vat_amount = v_vat,
    total_amount = v_total,
    paid_amount = v_paid,
    remaining_amount = GREATEST(v_total - v_paid, 0),
    payment_status = CASE
      WHEN v_paid <= 0 THEN 'unpaid'::public.sales_invoice_payment_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.sales_invoice_payment_status
      WHEN v_paid = v_total THEN 'paid'::public.sales_invoice_payment_status
      ELSE 'overpaid'::public.sales_invoice_payment_status
    END,
    status = CASE
      WHEN v_current_status IN ('draft','cancelled') THEN v_current_status
      WHEN v_paid <= 0 THEN 'approved'::public.sales_invoice_status
      WHEN v_paid < v_total THEN 'partially_paid'::public.sales_invoice_status
      WHEN v_paid >= v_total THEN 'paid'::public.sales_invoice_status
      ELSE v_current_status
    END
  WHERE id = p_invoice_id;
END $fn$;

REVOKE ALL ON FUNCTION public.sales_invoice_recalc_totals(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_invoice_recalc_totals(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.sales_invoice_items_after_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sales_invoice_recalc_totals(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.sales_invoice_recalc_totals(NEW.invoice_id);
    IF TG_OP='UPDATE' AND NEW.invoice_id <> OLD.invoice_id THEN
      PERFORM public.sales_invoice_recalc_totals(OLD.invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END $fn$;

CREATE TRIGGER sales_invoice_items_after_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.sales_invoice_items_after_change();

-- ============================================================
-- Recalc invoice paid_amount when linked finance_incomes change
-- ============================================================
CREATE OR REPLACE FUNCTION public.finance_incomes_after_invoice_link()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.sales_invoice_id IS NOT NULL THEN
      PERFORM public.sales_invoice_recalc_totals(NEW.sales_invoice_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.sales_invoice_id IS DISTINCT FROM OLD.sales_invoice_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      IF OLD.sales_invoice_id IS NOT NULL THEN
        PERFORM public.sales_invoice_recalc_totals(OLD.sales_invoice_id);
      END IF;
      IF NEW.sales_invoice_id IS NOT NULL AND NEW.sales_invoice_id IS DISTINCT FROM OLD.sales_invoice_id THEN
        PERFORM public.sales_invoice_recalc_totals(NEW.sales_invoice_id);
      ELSIF NEW.sales_invoice_id IS NOT NULL THEN
        PERFORM public.sales_invoice_recalc_totals(NEW.sales_invoice_id);
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.sales_invoice_id IS NOT NULL THEN
      PERFORM public.sales_invoice_recalc_totals(OLD.sales_invoice_id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $fn$;

DROP TRIGGER IF EXISTS finance_incomes_invoice_link_aiud ON public.finance_incomes;
CREATE TRIGGER finance_incomes_invoice_link_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_incomes
  FOR EACH ROW EXECUTE FUNCTION public.finance_incomes_after_invoice_link();

-- ============================================================
-- Guard: block edits to approved invoice sensitive fields (except recalc columns)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sales_invoices_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  -- Prevent deleting non-draft
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'لا يمكن حذف فاتورة غير مسودة (رقم %). أنشئ إشعار دائن للتصحيح.', OLD.invoice_number;
    END IF;
    RETURN OLD;
  END IF;

  -- Auto number on insert if missing
  IF TG_OP='INSERT' AND (NEW.invoice_number IS NULL OR NEW.invoice_number = '') THEN
    NEW.invoice_number := public.next_sales_invoice_number();
  END IF;

  IF TG_OP='UPDATE' THEN
    -- If invoice is approved/paid/partially_paid, freeze commercial fields
    IF OLD.status IN ('approved','partially_paid','paid') AND NEW.status <> 'cancelled' THEN
      -- Allow only these to change: paid_amount, remaining_amount, payment_status, status (progression), notes, internal_notes, approved_*, updated_at
      NEW.invoice_number := OLD.invoice_number;
      NEW.customer_id := OLD.customer_id;
      NEW.order_id := OLD.order_id;
      NEW.issue_date := OLD.issue_date;
      NEW.supply_date := OLD.supply_date;
      NEW.subtotal := OLD.subtotal;
      NEW.discount_amount := OLD.discount_amount;
      NEW.taxable_amount := OLD.taxable_amount;
      NEW.vat_amount := OLD.vat_amount;
      NEW.total_amount := OLD.total_amount;
      NEW.currency := OLD.currency;
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS sales_invoices_guard_biud ON public.sales_invoices;
CREATE TRIGGER sales_invoices_guard_biud
  BEFORE INSERT OR UPDATE OR DELETE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.sales_invoices_guard();

-- ============================================================
-- Guard: block editing items of approved invoices
-- ============================================================
CREATE OR REPLACE FUNCTION public.sales_invoice_items_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_status public.sales_invoice_status;
BEGIN
  IF TG_OP='DELETE' THEN
    SELECT status INTO v_status FROM public.sales_invoices WHERE id = OLD.invoice_id;
    IF v_status <> 'draft' THEN
      RAISE EXCEPTION 'لا يمكن تعديل بنود فاتورة معتمدة';
    END IF;
    RETURN OLD;
  ELSE
    SELECT status INTO v_status FROM public.sales_invoices WHERE id = NEW.invoice_id;
    IF v_status <> 'draft' THEN
      RAISE EXCEPTION 'لا يمكن تعديل بنود فاتورة معتمدة';
    END IF;
    RETURN NEW;
  END IF;
END $fn$;

DROP TRIGGER IF EXISTS sales_invoice_items_guard_biud ON public.sales_invoice_items;
CREATE TRIGGER sales_invoice_items_guard_biud
  BEFORE INSERT OR UPDATE OR DELETE ON public.sales_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.sales_invoice_items_guard();

-- ============================================================
-- Approve invoice (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_sales_invoice(p_invoice_id bigint)
RETURNS public.sales_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE v_row public.sales_invoices;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
          OR private.has_role(auth.uid(),'finance_manage')
          OR private.has_role(auth.uid(),'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_row FROM public.sales_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice not found'; END IF;
  IF v_row.status <> 'draft' THEN
    RETURN v_row; -- idempotent
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد فاتورة بدون بنود';
  END IF;

  UPDATE public.sales_invoices
     SET status = 'approved',
         approved_by = auth.uid(),
         approved_at = now()
   WHERE id = p_invoice_id
   RETURNING * INTO v_row;

  PERFORM public.sales_invoice_recalc_totals(p_invoice_id);
  SELECT * INTO v_row FROM public.sales_invoices WHERE id = p_invoice_id;
  RETURN v_row;
END $fn$;

REVOKE ALL ON FUNCTION public.approve_sales_invoice(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sales_invoice(bigint) TO authenticated;

-- ============================================================
-- Add collection_type to finance_incomes (nullable)
-- ============================================================
ALTER TABLE public.finance_incomes
  ADD COLUMN IF NOT EXISTS collection_type public.finance_collection_type;
