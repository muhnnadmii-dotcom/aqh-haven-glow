
-- =========================================================================
-- Permanent classifier + auto purchase-invoice linker for finance_expenses
-- =========================================================================

-- 1) Keyword classifier (pure). Returns NULLs when confidence is low.
CREATE OR REPLACE FUNCTION private.classify_expense_kw(
  p_item_name text,
  p_note text,
  p_supplier_id uuid
) RETURNS TABLE(tx_type finance_outgoing_type, business_rel finance_business_relation)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, private
AS $fn$
DECLARE
  v_text text;
BEGIN
  v_text := lower(coalesce(p_item_name,'') || ' ' || coalesce(p_note,''));

  -- owner withdrawal / personal
  IF v_text ~ '(سحب مالك|سحب شخصي|owner\s*draw|owner\s*withdraw|توزيع(\s*ارباح|\s*أرباح)?|حساب المالك|حساب شخصي)'
     OR v_text ~ '\yشخصي\y' THEN
    tx_type := 'owner_withdrawal';
    business_rel := 'owner_settlement';
    RETURN NEXT; RETURN;
  END IF;

  -- salaries
  IF v_text ~ '(راتب|رواتب|salary|payroll|أجور|اجور)' THEN
    tx_type := 'salary_payment';
    business_rel := 'business';
    RETURN NEXT; RETURN;
  END IF;

  -- government fees / tax
  IF v_text ~ '(gosi|تأمينات|جوسي|ضريبة القيمة|قيمة مضافة|vat|زكاة|الزكاة|الجمارك|جمارك|الجوازات|رسوم حكومي|مقيم|إقامة|اقامة|بلدية|مكتب العمل|هيئة الزكاة|شهادة|رخصة|رسوم|زكاه)' THEN
    tx_type := 'government_fee';
    business_rel := 'business';
    RETURN NEXT; RETURN;
  END IF;

  -- inventory
  IF v_text ~ '(aliexpress|amazon|علي\s*اكسبريس|علي\s*إكسبريس|أمازون|امازون|مخزون|علف|أسماك|اسماك|سمك|نبات|نباتات|قواقع|روبيان|shrimp|fish|plant|feed|stock|جمبري|طعام أسماك|طعام اسماك)' THEN
    tx_type := 'inventory_purchase';
    business_rel := 'business';
    RETURN NEXT; RETURN;
  END IF;

  -- direct operating expenses
  IF v_text ~ '(اشتراك|اشتراكات|محاسب|محاسبة|إعلان|اعلان|إعلانات|اعلانات|marketing|subscription|ads|advertis|accountant|snapchat|tiktok|google\s*ads|meta|facebook|instagram|hosting|domain|استضافة|دومين|نطاق|زين|stc|موبايلي)' THEN
    tx_type := 'direct_operating_expense';
    business_rel := 'business';
    RETURN NEXT; RETURN;
  END IF;

  -- supplier present w/o other match → supplier invoice payment
  IF p_supplier_id IS NOT NULL THEN
    tx_type := 'supplier_invoice_payment';
    business_rel := 'business';
    RETURN NEXT; RETURN;
  END IF;

  -- unclear
  tx_type := NULL;
  business_rel := NULL;
  RETURN NEXT;
END $fn$;

REVOKE ALL ON FUNCTION private.classify_expense_kw(text,text,uuid) FROM PUBLIC, anon, authenticated;

-- 2) Auto-link or create a purchase invoice for a classified expense.
--    Returns the linked purchase_invoice_id, or NULL if not applicable.
CREATE OR REPLACE FUNCTION private.finance_expense_link_pi(p_expense_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE
  r public.finance_expenses%ROWTYPE;
  v_pi_id bigint;
  v_is_vat boolean := false;
  v_subtotal numeric(14,2);
  v_vat numeric(14,2);
  v_total numeric(14,2);
  v_ded purchase_vat_deductibility;
  v_ptype purchase_type;
  v_desc text;
BEGIN
  SELECT * INTO r FROM public.finance_expenses WHERE id = p_expense_id;
  IF NOT FOUND OR r.deleted_at IS NOT NULL OR r.purchase_invoice_id IS NOT NULL THEN
    RETURN NULL;
  END IF;
  IF r.transaction_type NOT IN ('supplier_invoice_payment','inventory_purchase','direct_operating_expense','asset_purchase') THEN
    RETURN NULL;
  END IF;

  v_total := r.amount;
  v_desc  := coalesce(nullif(trim(r.item_name),''),'بند');

  -- (a) Try to match existing invoice: same supplier, ±3 days, same total
  IF r.supplier_id IS NOT NULL THEN
    SELECT id INTO v_pi_id
    FROM public.purchase_invoices
    WHERE supplier_id = r.supplier_id
      AND issue_date BETWEEN r.expense_date - 3 AND r.expense_date + 3
      AND total_amount = v_total
      AND status IN ('draft','under_review','approved','partially_paid','paid')
    ORDER BY abs(issue_date - r.expense_date) ASC, id DESC
    LIMIT 1;

    IF v_pi_id IS NOT NULL THEN
      UPDATE public.finance_expenses
         SET purchase_invoice_id = v_pi_id, updated_at = now()
       WHERE id = r.id;
      RETURN v_pi_id;
    END IF;
  END IF;

  -- (b) Create new invoice
  IF r.supplier_id IS NOT NULL THEN
    SELECT is_vat_registered INTO v_is_vat FROM public.finance_suppliers WHERE id = r.supplier_id;
  END IF;
  v_is_vat := coalesce(v_is_vat, false);

  IF v_is_vat THEN
    v_subtotal := round(v_total / 1.15, 2);
    v_vat      := round(v_total - v_subtotal, 2);
    v_ded      := 'fully_deductible';
  ELSE
    v_subtotal := v_total;
    v_vat      := 0;
    v_ded      := 'non_deductible';
  END IF;

  v_ptype := CASE r.transaction_type
    WHEN 'inventory_purchase' THEN 'inventory'
    WHEN 'asset_purchase'     THEN 'asset'
    ELSE 'operating_expense'
  END::purchase_type;

  INSERT INTO public.purchase_invoices (
    supplier_id, issue_date, supply_date, purchase_type, status, payment_status,
    subtotal, discount_amount, taxable_amount, vat_amount,
    deductible_vat_amount, non_deductible_vat_amount,
    total_amount, paid_amount, remaining_amount,
    vat_deductibility, deductible_percentage, non_deductible_reason,
    attachment_required, notes, currency
  ) VALUES (
    r.supplier_id, r.expense_date, r.expense_date, v_ptype, 'draft', 'unpaid',
    v_subtotal, 0, v_subtotal, v_vat,
    CASE WHEN v_is_vat THEN v_vat ELSE 0 END,
    CASE WHEN v_is_vat THEN 0     ELSE v_vat END,
    v_total, 0, v_total,
    v_ded,
    CASE WHEN v_is_vat THEN 100 ELSE 0 END,
    CASE WHEN v_is_vat THEN NULL ELSE 'invalid_supplier_tax_data'::purchase_non_deductible_reason END,
    false,
    'مولدة تلقائياً من مدفوعة ' || to_char(r.expense_date,'YYYY-MM-DD') || ' — ' || v_desc,
    'SAR'
  ) RETURNING id INTO v_pi_id;

  INSERT INTO public.purchase_invoice_items (
    purchase_invoice_id, description, quantity, unit_price, discount_amount,
    tax_code, tax_rate, line_subtotal, line_tax_amount, line_total, sort_order
  ) VALUES (
    v_pi_id, v_desc, 1, v_subtotal, 0,
    (CASE WHEN v_is_vat THEN 'standard_15' ELSE 'out_of_scope' END)::sales_invoice_tax_code,
    CASE WHEN v_is_vat THEN 15 ELSE 0 END,
    v_subtotal, v_vat, v_total, 0
  );

  UPDATE public.purchase_invoices
     SET status = 'paid', payment_status = 'paid',
         paid_amount = v_total, remaining_amount = 0,
         approved_at = now()
   WHERE id = v_pi_id;

  UPDATE public.finance_expenses
     SET purchase_invoice_id = v_pi_id, updated_at = now()
   WHERE id = r.id;

  RETURN v_pi_id;
END $fn$;

REVOKE ALL ON FUNCTION private.finance_expense_link_pi(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Trigger: classify + link automatically on insert/update.
CREATE OR REPLACE FUNCTION public.finance_expenses_auto_classify_and_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE
  v_tx  finance_outgoing_type;
  v_br  finance_business_relation;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  -- classify if not yet classified
  IF NEW.transaction_type IS NULL OR NEW.accounting_status = 'unclassified' THEN
    SELECT tx_type, business_rel INTO v_tx, v_br
    FROM private.classify_expense_kw(NEW.item_name, NEW.note, NEW.supplier_id);

    IF v_tx IS NOT NULL THEN
      UPDATE public.finance_expenses
         SET transaction_type   = v_tx,
             business_relation  = CASE WHEN business_relation = 'unclassified'
                                       THEN v_br ELSE business_relation END,
             accounting_status  = CASE WHEN accounting_status = 'unclassified'
                                       THEN 'classified' ELSE accounting_status END,
             updated_at         = now()
       WHERE id = NEW.id
         AND transaction_type IS NULL;
    END IF;
  END IF;

  -- auto-link invoice
  PERFORM private.finance_expense_link_pi(NEW.id);

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS finance_expenses_auto_classify_link ON public.finance_expenses;
CREATE TRIGGER finance_expenses_auto_classify_link
AFTER INSERT OR UPDATE OF item_name, note, supplier_id, amount, expense_date, accounting_status, transaction_type
ON public.finance_expenses
FOR EACH ROW
WHEN (pg_trigger_depth() < 1)
EXECUTE FUNCTION public.finance_expenses_auto_classify_and_link();

-- 4) Backfill helper: process up to N rows that still need an invoice.
--    Returns a per-row report.
CREATE OR REPLACE FUNCTION public.finance_expenses_backfill_link(
  p_limit int DEFAULT 30,
  p_only_supplier_kind text DEFAULT NULL  -- 'vat' | 'non_vat' | 'no_supplier' | NULL
) RETURNS TABLE(
  expense_id uuid,
  expense_date date,
  amount numeric,
  supplier_id uuid,
  supplier_vat_registered boolean,
  transaction_type finance_outgoing_type,
  action text,
  purchase_invoice_id bigint,
  invoice_subtotal numeric,
  invoice_vat numeric,
  invoice_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE
  r record;
  v_pi bigint;
  v_before bigint;
  v_action text;
  v_max_created bigint;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN
    SELECT e.id, e.expense_date, e.amount, e.supplier_id, e.transaction_type,
           coalesce(s.is_vat_registered,false) AS is_vat
      FROM public.finance_expenses e
      LEFT JOIN public.finance_suppliers s ON s.id = e.supplier_id
     WHERE e.deleted_at IS NULL
       AND e.accounting_status = 'classified'
       AND e.transaction_type IN ('supplier_invoice_payment','inventory_purchase',
                                  'direct_operating_expense','asset_purchase')
       AND e.purchase_invoice_id IS NULL
       AND (
         p_only_supplier_kind IS NULL
         OR (p_only_supplier_kind='vat'         AND s.is_vat_registered = true)
         OR (p_only_supplier_kind='non_vat'     AND e.supplier_id IS NOT NULL AND coalesce(s.is_vat_registered,false)=false)
         OR (p_only_supplier_kind='no_supplier' AND e.supplier_id IS NULL)
       )
     ORDER BY e.expense_date DESC, e.id
     LIMIT p_limit
  LOOP
    SELECT coalesce(max(id),0) INTO v_before FROM public.purchase_invoices;
    v_pi := private.finance_expense_link_pi(r.id);
    SELECT coalesce(max(id),0) INTO v_max_created FROM public.purchase_invoices;

    IF v_pi IS NULL THEN
      v_action := 'skipped';
    ELSIF v_pi > v_before THEN
      v_action := 'created';
    ELSE
      v_action := 'matched_existing';
    END IF;

    expense_id := r.id;
    expense_date := r.expense_date;
    amount := r.amount;
    supplier_id := r.supplier_id;
    supplier_vat_registered := r.is_vat;
    transaction_type := r.transaction_type;
    action := v_action;
    purchase_invoice_id := v_pi;
    IF v_pi IS NOT NULL THEN
      SELECT pi.subtotal, pi.vat_amount, pi.total_amount
        INTO invoice_subtotal, invoice_vat, invoice_total
        FROM public.purchase_invoices pi WHERE pi.id = v_pi;
    ELSE
      invoice_subtotal := NULL; invoice_vat := NULL; invoice_total := NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END $fn$;

REVOKE ALL ON FUNCTION public.finance_expenses_backfill_link(int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_expenses_backfill_link(int,text) TO authenticated;
