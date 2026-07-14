
CREATE OR REPLACE VIEW public.v_gateway_collection_exceptions AS
WITH ci AS (
  SELECT si.id AS invoice_id,
         si.total_amount,
         si.payment_provider::text AS invoice_provider,
         COUNT(DISTINCT pst.provider_id) AS provider_count,
         MAX(pp.provider_code::text) AS single_provider_code,
         COALESCE(SUM(CASE WHEN psl.line_type IN ('sale','refund','partial_refund') THEN psl.amount END),0) AS net_amount
  FROM public.sales_invoices si
  JOIN public.payment_settlement_lines psl ON psl.sales_invoice_id = si.id
  JOIN public.payment_settlements pst ON pst.id = psl.settlement_id
  JOIN public.payment_providers pp ON pp.id = pst.provider_id
  GROUP BY si.id
)
SELECT ci.invoice_id, ci.invoice_provider, ci.single_provider_code,
       ci.provider_count, ci.total_amount, ci.net_amount,
       CASE
         WHEN ci.provider_count > 1 THEN 'provider_conflict'
         WHEN ci.single_provider_code IS DISTINCT FROM ci.invoice_provider THEN 'provider_conflict'
         WHEN ABS(ci.net_amount - ci.total_amount) > 0.05 THEN 'amount_mismatch'
         WHEN NOT EXISTS (SELECT 1 FROM public.journal_entries je
                          WHERE je.source_type='sales_invoice_approval'
                            AND je.source_id=ci.invoice_id::text
                            AND je.status='posted') THEN 'missing_approval'
         WHEN EXISTS (SELECT 1 FROM public.journal_entries je
                      WHERE je.source_type='sales_invoice_collection'
                        AND je.source_id=ci.invoice_id::text
                        AND je.status <> 'reversed') THEN 'existing_collection'
         ELSE 'safe'
       END AS reason
FROM ci;
GRANT SELECT ON public.v_gateway_collection_exceptions TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_gateway_draft_summary AS
WITH coll AS (
  SELECT je.source_id::bigint AS invoice_id, je.total_debit
  FROM public.journal_entries je
  WHERE je.source_type='sales_invoice_collection' AND je.status='draft'
),
coll_by_prov AS (
  SELECT si.payment_provider::text AS provider_code,
         COUNT(*)::int AS collection_drafts,
         COALESCE(SUM(c.total_debit),0)::numeric AS collection_total
  FROM coll c JOIN public.sales_invoices si ON si.id = c.invoice_id
  GROUP BY si.payment_provider
),
pay AS (
  SELECT je.source_id::uuid AS allocation_id, je.total_debit
  FROM public.journal_entries je
  WHERE je.source_type='payment_settlement_payout' AND je.status='draft'
),
pay_by_prov AS (
  SELECT pp.provider_code::text AS provider_code,
         COUNT(*)::int AS payout_drafts,
         COALESCE(SUM(p.total_debit),0)::numeric AS payout_total
  FROM pay p
  JOIN public.settlement_bank_allocations sba ON sba.id = p.allocation_id
  JOIN public.payment_settlements pst ON pst.id = sba.settlement_id
  JOIN public.payment_providers pp ON pp.id = pst.provider_id
  GROUP BY pp.provider_code
),
exc AS (
  SELECT e.invoice_provider AS provider_code, e.reason,
         COUNT(*)::int AS exception_count,
         COALESCE(SUM(e.total_amount),0)::numeric AS exception_total
  FROM public.v_gateway_collection_exceptions e
  WHERE e.reason <> 'safe'
  GROUP BY e.invoice_provider, e.reason
),
exc_agg AS (
  SELECT provider_code,
         SUM(exception_count)::int AS exceptions_total_count,
         jsonb_object_agg(reason, jsonb_build_object('count', exception_count, 'total', exception_total)) AS exceptions_by_reason
  FROM exc GROUP BY provider_code
),
providers AS (
  SELECT provider_code::text AS provider_code, name FROM public.payment_providers WHERE is_active
)
SELECT p.provider_code, p.name AS provider_name,
       COALESCE(c.collection_drafts, 0) AS collection_drafts,
       COALESCE(c.collection_total, 0)  AS collection_total,
       COALESCE(pa.payout_drafts, 0)    AS payout_drafts,
       COALESCE(pa.payout_total, 0)     AS payout_total,
       (COALESCE(c.collection_total,0) - COALESCE(pa.payout_total,0)) AS expected_clearing_balance,
       COALESCE(ea.exceptions_total_count, 0) AS excluded_invoices,
       COALESCE(ea.exceptions_by_reason, '{}'::jsonb) AS exceptions_by_reason
FROM providers p
LEFT JOIN coll_by_prov c  ON c.provider_code  = p.provider_code
LEFT JOIN pay_by_prov  pa ON pa.provider_code = p.provider_code
LEFT JOIN exc_agg      ea ON ea.provider_code = p.provider_code
ORDER BY p.provider_code;
GRANT SELECT ON public.v_gateway_draft_summary TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.build_gateway_journal_drafts(
  p_expected_collection_count int DEFAULT 800,
  p_expected_collection_total numeric DEFAULT 258327.74,
  p_expected_payout_count int DEFAULT 75,
  p_expected_payout_total numeric DEFAULT 278352.96
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ar_account uuid;
  v_cash_account uuid;
  v_coll_created int := 0;
  v_pay_created int := 0;
  v_safe_count int;
  v_safe_total numeric;
  v_pay_count int;
  v_pay_total numeric;
BEGIN
  IF v_uid IS NOT NULL
     AND NOT (private.has_role(v_uid, 'admin'::app_role)
           OR private.has_role(v_uid, 'finance_manage'::app_role)
           OR private.has_role(v_uid, 'finance_accountant'::app_role)) THEN
    RAISE EXCEPTION 'غير مصرح لبناء مسودات بوابات الدفع' USING ERRCODE='42501';
  END IF;

  SELECT id INTO v_ar_account FROM public.chart_of_accounts
  WHERE system_key='accounts_receivable' OR code='1200'
  ORDER BY (system_key='accounts_receivable') DESC LIMIT 1;
  SELECT id INTO v_cash_account FROM public.chart_of_accounts
  WHERE system_key='cash_bank' OR code='1100'
  ORDER BY (system_key='cash_bank') DESC LIMIT 1;
  IF v_ar_account IS NULL OR v_cash_account IS NULL THEN
    RAISE EXCEPTION 'حسابات الذمم/النقد غير موجودة في دليل الحسابات';
  END IF;

  CREATE TEMP TABLE _safe_coll ON COMMIT DROP AS
  WITH ci AS (
    SELECT si.id AS invoice_id, si.customer_id, si.total_amount,
           si.payment_provider::text AS invoice_provider,
           COUNT(DISTINCT pst.provider_id) AS provider_count,
           MAX(pp.provider_code::text) AS single_provider_code,
           MAX(pp.clearing_account_id) AS clearing_account_id,
           COALESCE(SUM(CASE WHEN psl.line_type IN ('sale','refund','partial_refund') THEN psl.amount END),0) AS net_amount,
           MAX(CASE WHEN psl.line_type IN ('sale','refund','partial_refund') THEN psl.transaction_date END) AS entry_date
    FROM public.sales_invoices si
    JOIN public.payment_settlement_lines psl ON psl.sales_invoice_id = si.id
    JOIN public.payment_settlements pst ON pst.id = psl.settlement_id
    JOIN public.payment_providers pp ON pp.id = pst.provider_id
    GROUP BY si.id
  )
  SELECT ci.invoice_id, ci.customer_id, ci.total_amount, ci.single_provider_code,
         ci.clearing_account_id, ci.entry_date
  FROM ci
  WHERE ci.provider_count = 1
    AND ci.single_provider_code = ci.invoice_provider
    AND ABS(ci.net_amount - ci.total_amount) <= 0.05
    AND EXISTS (SELECT 1 FROM public.journal_entries je
                 WHERE je.source_type='sales_invoice_approval'
                   AND je.source_id=ci.invoice_id::text
                   AND je.status='posted')
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries je
                     WHERE je.source_type='sales_invoice_collection'
                       AND je.source_id=ci.invoice_id::text
                       AND je.status <> 'reversed');

  SELECT COUNT(*), COALESCE(ROUND(SUM(total_amount)::numeric,2),0)
    INTO v_safe_count, v_safe_total FROM _safe_coll;

  CREATE TEMP TABLE _safe_pay ON COMMIT DROP AS
  SELECT sba.id AS allocation_id, sba.allocated_amount, fi.income_date,
         fi.account_id AS finance_account_id,
         pp.provider_code::text AS provider_code, pp.clearing_account_id
  FROM public.settlement_bank_allocations sba
  JOIN public.payment_settlements pst ON pst.id = sba.settlement_id
  JOIN public.payment_providers pp    ON pp.id  = pst.provider_id
  JOIN public.finance_incomes fi      ON fi.id  = sba.transaction_id
  WHERE sba.status = 'confirmed' AND fi.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.source_type='payment_settlement_payout'
        AND je.source_id = sba.id::text
        AND je.status <> 'reversed'
    );

  SELECT COUNT(*), COALESCE(ROUND(SUM(allocated_amount)::numeric,2),0)
    INTO v_pay_count, v_pay_total FROM _safe_pay;

  IF v_safe_count = 0 AND v_pay_count = 0 THEN
    RETURN jsonb_build_object('status','noop','collection_drafts_created',0,'payout_drafts_created',0);
  END IF;

  IF v_safe_count > 0
     AND (v_safe_count <> p_expected_collection_count
       OR v_safe_total <> p_expected_collection_total) THEN
    RAISE EXCEPTION 'safety mismatch (collections): actual=%/% expected=%/%',
      v_safe_count, v_safe_total, p_expected_collection_count, p_expected_collection_total;
  END IF;
  IF v_pay_count > 0
     AND (v_pay_count <> p_expected_payout_count
       OR v_pay_total <> p_expected_payout_total) THEN
    RAISE EXCEPTION 'safety mismatch (payouts): actual=%/% expected=%/%',
      v_pay_count, v_pay_total, p_expected_payout_count, p_expected_payout_total;
  END IF;

  CREATE TEMP TABLE _new_coll ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO public.journal_entries
      (entry_date, source_type, source_id, description, status, created_by)
    SELECT COALESCE(s.entry_date, CURRENT_DATE),
           'sales_invoice_collection'::journal_source_type,
           s.invoice_id::text,
           'تحصيل فاتورة عبر ' || s.single_provider_code || ' — مسودة تاريخية',
           'draft'::journal_entry_status, v_uid
    FROM _safe_coll s
    RETURNING id, source_id
  )
  SELECT ins.id AS je_id, s.invoice_id, s.customer_id, s.total_amount,
         s.clearing_account_id, s.single_provider_code
  FROM ins JOIN _safe_coll s ON s.invoice_id::text = ins.source_id;

  INSERT INTO public.journal_entry_lines
    (journal_entry_id, account_id, description, debit, credit, customer_id, line_order)
  SELECT je_id, clearing_account_id,
         'حساب وسيط ' || single_provider_code, total_amount, 0, NULL, 1 FROM _new_coll
  UNION ALL
  SELECT je_id, v_ar_account, 'ذمم عميل', 0, total_amount, customer_id, 2 FROM _new_coll;

  SELECT COUNT(*) INTO v_coll_created FROM _new_coll;

  CREATE TEMP TABLE _new_pay ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO public.journal_entries
      (entry_date, source_type, source_id, description, status, created_by)
    SELECT sp.income_date,
           'payment_settlement_payout'::journal_source_type,
           sp.allocation_id::text,
           'وصول تسوية ' || sp.provider_code || ' — مسودة تاريخية',
           'draft'::journal_entry_status, v_uid
    FROM _safe_pay sp
    RETURNING id, source_id
  )
  SELECT ins.id AS je_id, sp.allocation_id, sp.allocated_amount,
         sp.finance_account_id, sp.provider_code, sp.clearing_account_id
  FROM ins JOIN _safe_pay sp ON sp.allocation_id::text = ins.source_id;

  INSERT INTO public.journal_entry_lines
    (journal_entry_id, account_id, description, debit, credit, finance_account_id, line_order)
  SELECT je_id, v_cash_account,
         'نقد وبنوك — تسوية ' || provider_code, allocated_amount, 0, finance_account_id, 1 FROM _new_pay
  UNION ALL
  SELECT je_id, clearing_account_id,
         'إغلاق حساب وسيط ' || provider_code, 0, allocated_amount, NULL, 2 FROM _new_pay;

  SELECT COUNT(*) INTO v_pay_created FROM _new_pay;

  RETURN jsonb_build_object(
    'status','ok',
    'collection_drafts_created', v_coll_created,
    'collection_total', v_safe_total,
    'payout_drafts_created', v_pay_created,
    'payout_total', v_pay_total
  );
END $$;

REVOKE ALL ON FUNCTION public.build_gateway_journal_drafts(int, numeric, int, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_gateway_journal_drafts(int, numeric, int, numeric) TO authenticated, service_role;
