
-- ============================================================
-- 1. Category-based classifier (primary logic)
-- ============================================================
CREATE OR REPLACE FUNCTION private.classify_expense_by_category(
  p_main_category_id uuid,
  p_sub_category_id uuid
) RETURNS TABLE(
  tx_type finance_outgoing_type,
  business_rel finance_business_relation,
  needs_pi boolean,
  resolved boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE
  v_main_name text;
  v_sub_name  text;
BEGIN
  IF p_main_category_id IS NULL THEN
    tx_type := NULL; business_rel := NULL; needs_pi := false; resolved := false;
    RETURN NEXT; RETURN;
  END IF;

  SELECT name INTO v_main_name FROM public.finance_categories WHERE id = p_main_category_id;
  IF p_sub_category_id IS NOT NULL THEN
    SELECT name INTO v_sub_name FROM public.finance_categories WHERE id = p_sub_category_id;
  END IF;

  -- Defaults
  needs_pi := false;
  resolved := true;
  business_rel := 'business';

  -- ---- No purchase invoice needed ----
  IF v_main_name = 'Personal' THEN
    tx_type := 'owner_withdrawal';
    business_rel := 'personal';
    RETURN NEXT; RETURN;
  END IF;

  IF v_main_name = 'توزيع الأرباح' THEN
    tx_type := 'owner_withdrawal';
    business_rel := 'owner_settlement';
    RETURN NEXT; RETURN;
  END IF;

  IF v_main_name = 'Administration & Management' AND v_sub_name = 'Government Fees' THEN
    tx_type := 'government_fee'; RETURN NEXT; RETURN;
  END IF;

  IF v_main_name = 'Administration & Management' AND v_sub_name = 'Bank Fees' THEN
    tx_type := 'other_outgoing'; RETURN NEXT; RETURN;
  END IF;

  IF v_main_name = 'Manpower & HR' AND v_sub_name = 'Salaries' THEN
    tx_type := 'salary_payment'; RETURN NEXT; RETURN;
  END IF;

  IF v_main_name = 'Refunds & Adjustments' THEN
    tx_type := 'customer_refund'; RETURN NEXT; RETURN;
  END IF;

  -- ---- Purchase invoice needed ----
  needs_pi := true;

  IF v_main_name = 'COGS' OR v_main_name = 'Inventory' THEN
    tx_type := 'inventory_purchase'; RETURN NEXT; RETURN;
  END IF;

  -- All remaining operational buckets → direct_operating_expense (with PI)
  IF v_main_name IN (
    'Delivery',
    'Marketing & Sales',
    'Miscellaneous',
    'Operations & Maintenance',
    'Subscriptions & Software',
    'Travel & Transportation'
  ) THEN
    tx_type := 'direct_operating_expense'; RETURN NEXT; RETURN;
  END IF;

  IF v_main_name = 'Manpower & HR' AND v_sub_name = 'Contractor Fees' THEN
    tx_type := 'direct_operating_expense'; RETURN NEXT; RETURN;
  END IF;

  IF v_main_name = 'Administration & Management'
     AND v_sub_name IN ('Insurance','Professional Services') THEN
    tx_type := 'direct_operating_expense'; RETURN NEXT; RETURN;
  END IF;

  -- Unknown category combo → not resolved, let keyword fallback try
  tx_type := NULL; business_rel := NULL; needs_pi := false; resolved := false;
  RETURN NEXT; RETURN;
END
$fn$;

REVOKE ALL ON FUNCTION private.classify_expense_by_category(uuid,uuid) FROM public, anon, authenticated;

-- ============================================================
-- 2. Rewrite trigger function: category first, keyword fallback
-- ============================================================
CREATE OR REPLACE FUNCTION public.finance_expenses_auto_classify_and_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE
  v_tx  finance_outgoing_type;
  v_br  finance_business_relation;
  v_needs boolean;
  v_ok  boolean;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.transaction_type IS NULL OR NEW.accounting_status = 'unclassified' THEN
    -- (1) Category-based classification first
    SELECT tx_type, business_rel, needs_pi, resolved
      INTO v_tx, v_br, v_needs, v_ok
    FROM private.classify_expense_by_category(NEW.main_category_id, NEW.sub_category_id);

    -- (2) Keyword fallback only when categories couldn't resolve
    IF NOT v_ok THEN
      SELECT tx_type, business_rel INTO v_tx, v_br
      FROM private.classify_expense_kw(NEW.item_name, NEW.note, NEW.supplier_id);
    END IF;

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

  -- auto-link invoice (link_pi already gates on tx_type)
  PERFORM private.finance_expense_link_pi(NEW.id);

  RETURN NEW;
END
$fn$;

-- ============================================================
-- 3. Fix the 4 wrong invoices from prior test
-- ============================================================
-- 3a. Unlink expenses from those invoices
UPDATE public.finance_expenses
   SET purchase_invoice_id = NULL,
       updated_at = now()
 WHERE purchase_invoice_id IN (
   SELECT id FROM public.purchase_invoices
    WHERE internal_reference IN ('PUR-2026-0145','PUR-2026-0146','PUR-2026-0148','PUR-2026-0149')
 );

-- 3b. Reject then delete the 4 invoices (guard allows delete for 'rejected')
UPDATE public.purchase_invoices
   SET status = 'rejected', updated_at = now()
 WHERE internal_reference IN ('PUR-2026-0145','PUR-2026-0146','PUR-2026-0148','PUR-2026-0149');

DELETE FROM public.purchase_invoices
 WHERE internal_reference IN ('PUR-2026-0145','PUR-2026-0146','PUR-2026-0148','PUR-2026-0149');

-- 3c. Reclassify the 4 expenses correctly (bypass classification path — we set explicitly)
UPDATE public.finance_expenses
   SET transaction_type = 'other_outgoing',
       business_relation = 'business',
       accounting_status = 'classified',
       updated_at = now()
 WHERE id IN (
   '28b0faaf-da76-4078-a516-1a441f703076'::uuid,   -- Payroll Bank Fees
   '415e2689-f8b2-48e9-bb2b-73336b847428'::uuid    -- Payroll Bank Fees
 );

UPDATE public.finance_expenses
   SET transaction_type = 'owner_withdrawal',
       business_relation = 'personal',
       accounting_status = 'classified',
       updated_at = now()
 WHERE id = '5bde3845-1f95-48c9-ab23-af6f4508894b'::uuid;   -- سلف (Personal)

UPDATE public.finance_expenses
   SET transaction_type = 'government_fee',
       business_relation = 'business',
       accounting_status = 'classified',
       updated_at = now()
 WHERE id = 'd11213c5-f932-46ec-9fa5-236a8bd7e01f'::uuid;   -- tax (Government Fees)
