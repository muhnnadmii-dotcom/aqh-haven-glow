-- 1) Business settings: add VAT-related columns (all safe defaults / nullable)
ALTER TABLE public.aqh_business_settings
  ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS filing_frequency text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS first_tax_period_start date,
  ADD COLUMN IF NOT EXISTS tax_basis text NOT NULL DEFAULT 'accrual',
  ADD COLUMN IF NOT EXISTS carried_forward_vat_credit numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commercial_registration text,
  ADD COLUMN IF NOT EXISTS tax_address text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='aqh_business_settings_filing_freq_chk') THEN
    ALTER TABLE public.aqh_business_settings
      ADD CONSTRAINT aqh_business_settings_filing_freq_chk
      CHECK (filing_frequency IN ('monthly','quarterly'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='aqh_business_settings_tax_basis_chk') THEN
    ALTER TABLE public.aqh_business_settings
      ADD CONSTRAINT aqh_business_settings_tax_basis_chk
      CHECK (tax_basis IN ('accrual','cash'));
  END IF;
END $$;

-- 2) Enum + tax_periods table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tax_period_status') THEN
    CREATE TYPE public.tax_period_status AS ENUM
      ('open','under_review','ready','filed','paid','closed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tax_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  due_date date,
  status public.tax_period_status NOT NULL DEFAULT 'open',
  carried_credit_in numeric(14,2) NOT NULL DEFAULT 0,
  carried_credit_used numeric(14,2) NOT NULL DEFAULT 0,
  carried_credit_out numeric(14,2) NOT NULL DEFAULT 0,
  filed_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_periods_date_order CHECK (end_date >= start_date),
  CONSTRAINT tax_periods_unique_range UNIQUE (start_date, end_date)
);
CREATE INDEX IF NOT EXISTS idx_tax_periods_dates ON public.tax_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tax_periods_status ON public.tax_periods(status);

GRANT SELECT, INSERT, UPDATE ON public.tax_periods TO authenticated;
GRANT ALL ON public.tax_periods TO service_role;
ALTER TABLE public.tax_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_periods_read ON public.tax_periods;
CREATE POLICY tax_periods_read ON public.tax_periods FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
DROP POLICY IF EXISTS tax_periods_write ON public.tax_periods;
CREATE POLICY tax_periods_write ON public.tax_periods FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

DROP TRIGGER IF EXISTS trg_tax_periods_touch ON public.tax_periods;
CREATE TRIGGER trg_tax_periods_touch BEFORE UPDATE ON public.tax_periods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) tax_return_snapshots
CREATE TABLE IF NOT EXISTS public.tax_return_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.tax_periods(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  filed_at timestamptz,
  filed_by uuid,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_return_snapshots_status_chk
    CHECK (status IN ('draft','under_review','approved_internally','marked_as_filed'))
);
-- Only one "marked_as_filed" per period (immutable snapshot)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_return_snapshots_filed_unique
  ON public.tax_return_snapshots(period_id) WHERE status = 'marked_as_filed';
CREATE INDEX IF NOT EXISTS idx_tax_return_snapshots_period ON public.tax_return_snapshots(period_id);

GRANT SELECT, INSERT ON public.tax_return_snapshots TO authenticated;
GRANT ALL ON public.tax_return_snapshots TO service_role;
ALTER TABLE public.tax_return_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_snapshots_read ON public.tax_return_snapshots;
CREATE POLICY tax_snapshots_read ON public.tax_return_snapshots FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
DROP POLICY IF EXISTS tax_snapshots_write ON public.tax_return_snapshots;
CREATE POLICY tax_snapshots_write ON public.tax_return_snapshots FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

-- 4) RPCs

-- 4a) Period summary (live numbers, accrual basis)
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
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT start_date, end_date, carried_credit_in, carried_credit_used
    INTO v_start, v_end, v_carried_in, v_carried_used
    FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;

  -- Sales (approved / partially_paid / paid)
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

  -- Purchases (approved / partially_paid / paid)
  SELECT
    COALESCE(SUM(pi.taxable_amount),0),
    COALESCE(SUM(pi.vat_amount),0),
    COALESCE(SUM(pi.deductible_vat_amount),0),
    COALESCE(SUM(pi.non_deductible_vat_amount),0)
  INTO v_std_purch, v_input_vat, v_deductible, v_nondeductible
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  -- Purchase items zero/exempt breakdown (approx by items)
  SELECT
    COALESCE(SUM(CASE WHEN it.tax_code='zero_rated' THEN it.line_subtotal END),0),
    COALESCE(SUM(CASE WHEN it.tax_code='exempt' THEN it.line_subtotal END),0)
  INTO v_zero_purch, v_exempt_purch
  FROM public.purchase_invoices pi
  JOIN public.purchase_invoice_items it ON it.purchase_invoice_id = pi.id
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end;

  -- Counters for the dashboard
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
      'total', v_std_sales + v_zero_sales + v_exempt_sales + v_oos_sales
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
      'suspected_duplicates', v_dup
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
REVOKE ALL ON FUNCTION public.vat_get_period_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_get_period_summary(uuid) TO authenticated;

-- 4b) Sales lines
CREATE OR REPLACE FUNCTION public.vat_get_sales_lines(p_period_id uuid)
RETURNS TABLE(
  invoice_id bigint, invoice_number text, customer_id uuid, customer_name text,
  invoice_date date, taxable_amount numeric, tax_code text,
  vat_amount numeric, total_amount numeric, status text
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, private
AS $$
DECLARE v_start date; v_end date;
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;
  RETURN QUERY
  SELECT si.id, si.invoice_number, si.customer_id,
         COALESCE(p.full_name, ''),
         COALESCE(si.supply_date, si.issue_date),
         si.taxable_amount, 'mixed'::text,
         si.vat_amount, si.total_amount, si.status::text
  FROM public.sales_invoices si
  LEFT JOIN public.profiles p ON p.id = si.customer_id
  WHERE si.status IN ('approved','partially_paid','paid')
    AND COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end
  ORDER BY COALESCE(si.supply_date, si.issue_date), si.invoice_number;
END $$;
REVOKE ALL ON FUNCTION public.vat_get_sales_lines(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_get_sales_lines(uuid) TO authenticated;

-- 4c) Purchase lines
CREATE OR REPLACE FUNCTION public.vat_get_purchase_lines(p_period_id uuid)
RETURNS TABLE(
  invoice_id bigint, internal_reference text, supplier_invoice_number text,
  supplier_id uuid, supplier_name text, invoice_date date,
  taxable_amount numeric, vat_amount numeric,
  deductible_vat_amount numeric, non_deductible_vat_amount numeric,
  vat_deductibility text, non_deductible_reason text,
  has_attachment boolean, status text
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, private
AS $$
DECLARE v_start date; v_end date;
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;
  RETURN QUERY
  SELECT pi.id, pi.internal_reference, pi.supplier_invoice_number,
         pi.supplier_id, COALESCE(fs.name, ''),
         COALESCE(pi.supply_date, pi.issue_date),
         pi.taxable_amount, pi.vat_amount,
         pi.deductible_vat_amount, pi.non_deductible_vat_amount,
         pi.vat_deductibility::text,
         COALESCE(pi.non_deductible_reason::text, ''),
         EXISTS(SELECT 1 FROM public.finance_attachments fa
                WHERE fa.related_type='purchase_invoice' AND fa.related_bigint_id = pi.id),
         pi.status::text
  FROM public.purchase_invoices pi
  LEFT JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
  ORDER BY COALESCE(pi.supply_date, pi.issue_date), pi.internal_reference;
END $$;
REVOKE ALL ON FUNCTION public.vat_get_purchase_lines(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_get_purchase_lines(uuid) TO authenticated;

-- 4d) Excluded invoices
CREATE OR REPLACE FUNCTION public.vat_get_excluded_invoices(p_period_id uuid)
RETURNS TABLE(
  source text, invoice_id bigint, reference text, party_name text,
  invoice_date date, amount numeric, vat_amount numeric,
  exclusion_reason text, status text
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, private
AS $$
DECLARE v_start date; v_end date;
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;

  RETURN QUERY
  -- Purchases: draft / under_review / rejected inside period
  SELECT 'purchase'::text, pi.id, COALESCE(pi.internal_reference, pi.supplier_invoice_number, ''),
         COALESCE(fs.name, ''), COALESCE(pi.supply_date, pi.issue_date),
         pi.taxable_amount, pi.vat_amount,
         CASE
           WHEN pi.status='draft' THEN 'draft'
           WHEN pi.status='under_review' THEN 'pending_review'
           WHEN pi.status='rejected' THEN 'rejected'
         END,
         pi.status::text
  FROM public.purchase_invoices pi
  LEFT JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
  WHERE COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.status IN ('draft','under_review','rejected')

  UNION ALL
  -- Approved purchases missing attachment
  SELECT 'purchase'::text, pi.id, COALESCE(pi.internal_reference, ''),
         COALESCE(fs.name, ''), COALESCE(pi.supply_date, pi.issue_date),
         pi.taxable_amount, pi.vat_amount,
         'missing_attachment'::text, pi.status::text
  FROM public.purchase_invoices pi
  LEFT JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.attachment_required = true
    AND (pi.attachment_exception_reason IS NULL OR pi.attachment_exception_reason='')
    AND NOT EXISTS (
      SELECT 1 FROM public.finance_attachments fa
      WHERE fa.related_type='purchase_invoice' AND fa.related_bigint_id = pi.id
    )

  UNION ALL
  -- Approved purchases with non-deductible VAT (informational)
  SELECT 'purchase'::text, pi.id, COALESCE(pi.internal_reference, ''),
         COALESCE(fs.name, ''), COALESCE(pi.supply_date, pi.issue_date),
         pi.taxable_amount, pi.non_deductible_vat_amount,
         'non_deductible'::text, pi.status::text
  FROM public.purchase_invoices pi
  LEFT JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.non_deductible_vat_amount > 0

  UNION ALL
  -- Suspected duplicates (same supplier + supplier invoice #)
  SELECT 'purchase'::text, pi.id, COALESCE(pi.internal_reference, ''),
         COALESCE(fs.name, ''), COALESCE(pi.supply_date, pi.issue_date),
         pi.taxable_amount, pi.vat_amount,
         'duplicate'::text, pi.status::text
  FROM public.purchase_invoices pi
  LEFT JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.supplier_id IS NOT NULL
    AND pi.supplier_invoice_number IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.purchase_invoices d
      WHERE d.supplier_id = pi.supplier_id
        AND d.supplier_invoice_number = pi.supplier_invoice_number
        AND d.id <> pi.id
    )

  UNION ALL
  -- Sales drafts/cancelled inside period
  SELECT 'sale'::text, si.id, si.invoice_number, COALESCE(p.full_name,''),
         COALESCE(si.supply_date, si.issue_date),
         si.taxable_amount, si.vat_amount,
         CASE WHEN si.status='draft' THEN 'draft' ELSE 'rejected' END,
         si.status::text
  FROM public.sales_invoices si
  LEFT JOIN public.profiles p ON p.id = si.customer_id
  WHERE COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end
    AND si.status IN ('draft','cancelled');
END $$;
REVOKE ALL ON FUNCTION public.vat_get_excluded_invoices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_get_excluded_invoices(uuid) TO authenticated;

-- 4e) Validate return
CREATE OR REPLACE FUNCTION public.vat_validate_return(p_period_id uuid)
RETURNS TABLE(severity text, code text, message text, related_id bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, private
AS $$
DECLARE v_start date; v_end date;
BEGIN
  IF NOT private.has_any_finance_role(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM public.tax_periods WHERE id = p_period_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'period not found'; END IF;

  RETURN QUERY
  -- CRITICAL: approved purchase without attachment
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
  -- CRITICAL: deductible > total vat
  SELECT 'error'::text, 'deductible_over_total'::text,
         'الضريبة القابلة للخصم أكبر من الضريبة الإجمالية للفاتورة: ' || COALESCE(pi.internal_reference, ''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.deductible_vat_amount > pi.vat_amount

  UNION ALL
  -- WARNING: pending review purchase inside period
  SELECT 'warning'::text, 'pending_review'::text,
         'فاتورة مشتريات لم يتم اعتمادها: ' || COALESCE(pi.internal_reference, pi.supplier_invoice_number, ''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('draft','under_review')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end

  UNION ALL
  -- WARNING: suspected duplicate
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
  -- WARNING: sales draft in period
  SELECT 'warning'::text, 'sale_draft'::text,
         'فاتورة مبيعات ما زالت مسودة داخل الفترة: ' || si.invoice_number,
         si.id
  FROM public.sales_invoices si
  WHERE si.status = 'draft'
    AND COALESCE(si.supply_date, si.issue_date) BETWEEN v_start AND v_end

  UNION ALL
  -- WARNING: vat amount vs rate mismatch (>1 SAR variance)
  SELECT 'warning'::text, 'vat_rate_mismatch'::text,
         'ضريبة فاتورة لا تطابق نسبة 15% مقارنة بالمبلغ الخاضع: ' || COALESCE(pi.internal_reference,''),
         pi.id
  FROM public.purchase_invoices pi
  WHERE pi.status IN ('approved','partially_paid','paid')
    AND COALESCE(pi.supply_date, pi.issue_date) BETWEEN v_start AND v_end
    AND pi.taxable_amount > 0
    AND ABS(pi.vat_amount - ROUND(pi.taxable_amount * 0.15, 2)) > 1;
END $$;
REVOKE ALL ON FUNCTION public.vat_validate_return(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_validate_return(uuid) TO authenticated;

-- 4f) Mark as filed (snapshot)
CREATE OR REPLACE FUNCTION public.vat_mark_as_filed(p_period_id uuid, p_override_reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_summary jsonb;
  v_lines jsonb;
  v_id uuid;
  v_actor uuid := auth.uid();
  v_errors int;
BEGIN
  IF NOT (private.has_role(v_actor,'admin') OR private.has_role(v_actor,'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Guard: block if a critical error exists AND no override reason provided by admin
  SELECT COUNT(*) INTO v_errors FROM public.vat_validate_return(p_period_id) WHERE severity='error';
  IF v_errors > 0 AND (p_override_reason IS NULL OR p_override_reason='') THEN
    RAISE EXCEPTION 'يوجد % أخطاء حرجة، لا يمكن الاعتماد بدون تجاوز موثق', v_errors;
  END IF;

  -- Idempotency: return existing filed snapshot if present
  SELECT id INTO v_id FROM public.tax_return_snapshots
    WHERE period_id = p_period_id AND status='marked_as_filed' LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_summary := public.vat_get_period_summary(p_period_id);

  -- Frozen line items (sales + purchases)
  SELECT jsonb_build_object(
    'sales', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.vat_get_sales_lines(p_period_id) s), '[]'::jsonb),
    'purchases', COALESCE((SELECT jsonb_agg(to_jsonb(pu)) FROM public.vat_get_purchase_lines(p_period_id) pu), '[]'::jsonb)
  ) INTO v_lines;

  INSERT INTO public.tax_return_snapshots(period_id, status, summary, line_items, filed_at, filed_by, override_reason)
  VALUES (p_period_id, 'marked_as_filed', v_summary, v_lines, now(), v_actor, p_override_reason)
  RETURNING id INTO v_id;

  UPDATE public.tax_periods
    SET status = 'filed', filed_at = now()
    WHERE id = p_period_id;

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, note, changed_by)
  VALUES ('tax_periods', p_period_id, 'mark_as_filed', p_override_reason, v_actor);

  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.vat_mark_as_filed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_mark_as_filed(uuid, text) TO authenticated;