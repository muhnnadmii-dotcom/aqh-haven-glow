
-- =============================================================================
-- Phase 1 (READ-ONLY) — Accounting Posting Review Scanner
-- Does NOT modify any journal_entries, finance_expenses, finance_incomes,
-- invoices, or triggers. Adds two SECURITY DEFINER STABLE functions used
-- by the new /admin/finance/posting-review page.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.finance_posting_scan(
  p_from date,
  p_to   date
)
RETURNS TABLE (
  op_kind           text,
  op_id             text,
  op_date           date,
  op_amount         numeric,
  counterparty      text,
  provider_code     text,
  existing_je_id    uuid,
  existing_je_number text,
  existing_status   text,
  existing_total    numeric,
  existing_lines    jsonb,
  classification    text,
  diff_reason       text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $fn$
  WITH ops AS (
    -- 1) Sales invoice approvals
    SELECT
      'sales_invoice_approval'::text            AS op_kind,
      si.id::text                                AS op_id,
      si.issue_date                              AS op_date,
      si.total_amount                            AS op_amount,
      COALESCE(p.full_name, si.customer_id::text) AS counterparty,
      si.payment_provider::text                  AS provider_code
    FROM public.sales_invoices si
    LEFT JOIN public.profiles p ON p.id = si.customer_id
    WHERE si.status IN ('approved','partially_paid','paid')
      AND si.issue_date BETWEEN p_from AND p_to

    UNION ALL
    -- 2) Purchase invoice approvals
    SELECT
      'purchase_invoice_approval',
      pi.id::text,
      pi.issue_date,
      pi.total_amount,
      COALESCE(fs.name, pi.supplier_id::text),
      NULL
    FROM public.purchase_invoices pi
    LEFT JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
    WHERE pi.status IN ('approved','partially_paid','paid')
      AND pi.issue_date BETWEEN p_from AND p_to

    UNION ALL
    -- 3) Supplier payments (finance_expenses linked to a purchase invoice)
    SELECT
      'purchase_invoice_payment',
      fe.id::text,
      fe.expense_date,
      fe.amount,
      COALESCE(fs.name, fe.supplier_id::text),
      NULL
    FROM public.finance_expenses fe
    LEFT JOIN public.finance_suppliers fs ON fs.id = fe.supplier_id
    WHERE fe.deleted_at IS NULL
      AND fe.purchase_invoice_id IS NOT NULL
      AND fe.expense_date BETWEEN p_from AND p_to

    UNION ALL
    -- 4) Internal transfers (outgoing leg)
    SELECT
      'internal_transfer',
      fe.id::text,
      fe.expense_date,
      fe.amount,
      COALESCE(fa.name, 'حساب'),
      NULL
    FROM public.finance_expenses fe
    LEFT JOIN public.finance_accounts fa ON fa.id = fe.account_id
    WHERE fe.deleted_at IS NULL
      AND fe.transaction_type = 'internal_transfer_out'
      AND fe.expense_date BETWEEN p_from AND p_to

    UNION ALL
    -- 5) Owner withdrawal / owner settlement
    SELECT
      'owner_withdrawal',
      fe.id::text,
      fe.expense_date,
      fe.amount,
      COALESCE(fa.name, 'المالك'),
      NULL
    FROM public.finance_expenses fe
    LEFT JOIN public.finance_accounts fa ON fa.id = fe.account_id
    WHERE fe.deleted_at IS NULL
      AND (
        fe.transaction_type = 'owner_withdrawal'
        OR (fe.business_relation = 'owner_settlement')
      )
      AND fe.expense_date BETWEEN p_from AND p_to

    UNION ALL
    -- 6) Gateway collections (sales_invoice_collection) — invoices settled via a provider
    SELECT
      'sales_invoice_collection',
      si.id::text,
      si.issue_date,
      si.total_amount,
      COALESCE(p.full_name, si.customer_id::text),
      MAX(pp.provider_code::text)
    FROM public.sales_invoices si
    LEFT JOIN public.profiles p ON p.id = si.customer_id
    JOIN public.payment_settlement_lines psl ON psl.sales_invoice_id = si.id
    JOIN public.payment_settlements pst ON pst.id = psl.settlement_id
    JOIN public.payment_providers pp ON pp.id = pst.provider_id
    WHERE si.issue_date BETWEEN p_from AND p_to
      AND si.status IN ('approved','partially_paid','paid')
    GROUP BY si.id, p.full_name

    UNION ALL
    -- 7) Payment settlement payouts (allocations confirmed)
    SELECT
      'payment_settlement_payout',
      sba.id::text,
      fi.income_date,
      sba.allocated_amount,
      COALESCE(fa.name, 'بنك'),
      pp.provider_code::text
    FROM public.settlement_bank_allocations sba
    JOIN public.payment_settlements pst ON pst.id = sba.settlement_id
    JOIN public.payment_providers pp    ON pp.id  = pst.provider_id
    JOIN public.finance_incomes fi      ON fi.id  = sba.transaction_id
    LEFT JOIN public.finance_accounts fa ON fa.id = fi.account_id
    WHERE sba.status = 'confirmed'
      AND fi.deleted_at IS NULL
      AND fi.income_date BETWEEN p_from AND p_to
  ),
  active_je AS (
    SELECT
      je.source_type::text AS source_type,
      je.source_id,
      je.id,
      je.entry_number,
      je.status::text      AS status,
      je.total_debit,
      COUNT(*)  OVER (PARTITION BY je.source_type, je.source_id) AS active_count
    FROM public.journal_entries je
    WHERE je.status <> 'reversed'
      AND je.source_type <> 'manual'
      AND je.source_id IS NOT NULL
  ),
  matched AS (
    SELECT
      o.*,
      aje.id            AS existing_je_id,
      aje.entry_number  AS existing_je_number,
      aje.status        AS existing_status,
      aje.total_debit   AS existing_total,
      aje.active_count
    FROM ops o
    LEFT JOIN active_je aje
           ON aje.source_type = o.op_kind
          AND aje.source_id   = o.op_id
  )
  SELECT
    m.op_kind,
    m.op_id,
    m.op_date,
    m.op_amount,
    m.counterparty,
    m.provider_code,
    m.existing_je_id,
    m.existing_je_number,
    m.existing_status,
    m.existing_total,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
                 'account_id', jel.account_id,
                 'account_code', coa.code,
                 'account_name', coa.name_ar,
                 'system_key', coa.system_key,
                 'debit', jel.debit,
                 'credit', jel.credit,
                 'description', jel.description,
                 'line_order', jel.line_order
               ) ORDER BY jel.line_order)
        FROM public.journal_entry_lines jel
        LEFT JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
        WHERE jel.journal_entry_id = m.existing_je_id
      ),
      '[]'::jsonb
    ) AS existing_lines,
    CASE
      WHEN m.existing_je_id IS NULL              THEN 'missing'
      WHEN COALESCE(m.active_count,0) > 1        THEN 'duplicate'
      WHEN m.existing_status = 'draft'           THEN 'draft_pending'
      WHEN m.existing_status = 'posted'
           AND ABS(COALESCE(m.op_amount,0) - COALESCE(m.existing_total,0)) <= 0.05
                                                 THEN 'correct'
      WHEN m.existing_status = 'posted'          THEN 'mismatch'
      ELSE 'out_of_scope'
    END AS classification,
    CASE
      WHEN m.existing_je_id IS NULL              THEN 'لا يوجد قيد'
      WHEN COALESCE(m.active_count,0) > 1        THEN 'أكثر من قيد نشط لنفس المصدر'
      WHEN m.existing_status = 'draft'           THEN 'قيد مسودة بانتظار المراجعة'
      WHEN m.existing_status = 'posted'
           AND ABS(COALESCE(m.op_amount,0) - COALESCE(m.existing_total,0)) > 0.05
        THEN 'فرق في المبلغ: عملية=' || m.op_amount::text || ' | قيد=' || m.existing_total::text
      ELSE NULL
    END AS diff_reason
  FROM matched m
  ORDER BY m.op_date DESC, m.op_kind, m.op_id;
$fn$;

REVOKE ALL ON FUNCTION public.finance_posting_scan(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_posting_scan(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.finance_posting_scan(date, date) IS
'Phase-1 read-only scanner. Lists all business operations in the range and compares each with its active journal entry. Classification: correct/draft_pending/missing/mismatch/duplicate/out_of_scope. Does not modify data.';


CREATE OR REPLACE FUNCTION public.finance_posting_summary(
  p_from date,
  p_to   date
)
RETURNS TABLE (
  op_kind        text,
  classification text,
  cnt            bigint,
  total_amount   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $fn$
  SELECT op_kind, classification,
         COUNT(*)::bigint AS cnt,
         COALESCE(SUM(op_amount),0)::numeric AS total_amount
  FROM public.finance_posting_scan(p_from, p_to)
  GROUP BY op_kind, classification
  ORDER BY op_kind, classification;
$fn$;

REVOKE ALL ON FUNCTION public.finance_posting_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_posting_summary(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.finance_posting_summary(date, date) IS
'Aggregate counts and totals per (op_kind, classification) for the posting review UI. Read-only.';
