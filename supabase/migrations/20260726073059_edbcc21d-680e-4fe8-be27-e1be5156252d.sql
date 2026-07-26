
-- =============================================================================
-- Phase 1 (READ-ONLY) — Corrective Rewrite of Accounting Posting Scanner
--
-- Does NOT touch any trigger, auto-post function, journal entry,
-- finance_expense, finance_income, invoice, settlement, or accounting period.
-- Uses CREATE OR REPLACE only on the read-only diagnostic functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Core: full unpaginated classified rows (private-ish; wrappers filter).
--    Returns one row per business operation with expected + existing lines
--    and classification computed from real posting rules.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_posting_scan_all(
  p_from date,
  p_to   date
)
RETURNS TABLE (
  op_kind              text,
  op_id                text,
  op_date              date,
  op_amount            numeric,
  counterparty         text,
  provider_code        text,
  expected_source_type text,
  expected_source_id   text,
  expected_total       numeric,
  expected_lines       jsonb,
  existing_je_id       uuid,
  existing_je_number   text,
  existing_status      text,
  existing_entry_date  date,
  existing_total       numeric,
  existing_lines       jsonb,
  active_count         bigint,
  classification       text,
  diff_reason          text,
  blocked_reason       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_ar          uuid := public.acct_id('accounts_receivable');
  v_ap          uuid := public.acct_id('accounts_payable');
  v_cash        uuid := public.acct_id('cash_bank');
  v_sales       uuid := public.acct_id('sales_revenue');
  v_out_vat     uuid := public.acct_id('output_vat_payable');
  v_in_vat      uuid := public.acct_id('input_vat_deductible');
  v_nd_vat      uuid := public.acct_id('non_deductible_vat_expense');
  v_inv         uuid := public.acct_id('inventory');
  v_fa          uuid := public.acct_id('fixed_assets');
  v_gov         uuid := public.acct_id('government_fees');
  v_opex        uuid := public.acct_id('operating_expense');
  v_dfo         uuid := public.acct_id('due_from_owner');
  v_dto         uuid := public.acct_id('due_to_owner');
  v_owner_cap   uuid := public.acct_id('owner_capital');
  v_owner_draw  uuid := public.acct_id('owner_drawings');
  v_itc         uuid := public.acct_id('internal_transfer_clearing');
BEGIN
  IF v_uid IS NULL OR NOT (
       private.has_role(v_uid, 'admin'::app_role)
    OR private.has_role(v_uid, 'finance_manage'::app_role)
    OR private.has_role(v_uid, 'finance_accountant'::app_role)
  ) THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'invalid_date_range: from/to required' USING ERRCODE = '22007';
  END IF;
  IF p_from > p_to THEN
    RAISE EXCEPTION 'invalid_date_range: from > to' USING ERRCODE = '22007';
  END IF;
  IF (p_to - p_from) > 800 THEN
    RAISE EXCEPTION 'range_too_wide: max 800 days' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH ops AS (
    -- (1) sales_invoice_approval
    SELECT
      'sales_invoice_approval'::text AS op_kind,
      si.id::text AS op_id,
      si.issue_date AS op_date,
      si.total_amount::numeric AS op_amount,
      COALESCE(p.full_name, si.customer_id::text) AS counterparty,
      si.payment_provider::text AS provider_code,
      'sales_invoice_approval'::text AS expected_source_type,
      si.id::text AS expected_source_id,
      si.total_amount::numeric AS expected_total,
      CASE
        WHEN v_ar IS NULL OR v_sales IS NULL
             OR (COALESCE(si.vat_amount,0) > 0 AND v_out_vat IS NULL)
          THEN NULL::jsonb
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object('account_id', v_ar, 'debit', si.total_amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', v_sales, 'debit', 0, 'credit', si.taxable_amount)
            UNION ALL
            SELECT jsonb_build_object('account_id', v_out_vat, 'debit', 0, 'credit', si.vat_amount) WHERE COALESCE(si.vat_amount,0) > 0
          ) t
        )
      END AS expected_lines,
      CASE
        WHEN v_ar IS NULL OR v_sales IS NULL
          THEN 'حساب الذمم أو المبيعات غير موجود'
        WHEN COALESCE(si.vat_amount,0) > 0 AND v_out_vat IS NULL
          THEN 'حساب ضريبة المخرجات غير موجود'
        ELSE NULL
      END AS blocked_reason
    FROM public.sales_invoices si
    LEFT JOIN public.profiles p ON p.id = si.customer_id
    WHERE si.status IN ('approved','partially_paid','paid')
      AND si.issue_date BETWEEN p_from AND p_to

    UNION ALL
    -- (2) purchase_invoice_approval
    SELECT
      'purchase_invoice_approval'::text,
      pi.id::text,
      pi.issue_date,
      pi.total_amount::numeric,
      COALESCE(fs.name, pi.supplier_id::text),
      NULL::text,
      'purchase_invoice_approval'::text,
      pi.id::text,
      pi.total_amount::numeric,
      CASE
        WHEN v_ap IS NULL THEN NULL
        WHEN CASE pi.purchase_type::text
               WHEN 'inventory' THEN v_inv
               WHEN 'asset' THEN v_fa
               WHEN 'government_fee' THEN v_gov
               ELSE v_opex END IS NULL THEN NULL
        WHEN COALESCE(pi.deductible_vat_amount,0)>0 AND v_in_vat IS NULL THEN NULL
        WHEN COALESCE(pi.non_deductible_vat_amount,0)>0 AND v_nd_vat IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object(
                     'account_id',
                     CASE pi.purchase_type::text
                       WHEN 'inventory' THEN v_inv
                       WHEN 'asset' THEN v_fa
                       WHEN 'government_fee' THEN v_gov
                       ELSE v_opex
                     END,
                     'debit', pi.taxable_amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', v_in_vat, 'debit', pi.deductible_vat_amount, 'credit', 0)
              WHERE COALESCE(pi.deductible_vat_amount,0) > 0
            UNION ALL
            SELECT jsonb_build_object('account_id', v_nd_vat, 'debit', pi.non_deductible_vat_amount, 'credit', 0)
              WHERE COALESCE(pi.non_deductible_vat_amount,0) > 0
            UNION ALL
            SELECT jsonb_build_object('account_id', v_ap, 'debit', 0, 'credit', pi.total_amount)
          ) t
        )
      END,
      CASE
        WHEN v_ap IS NULL THEN 'حساب الموردون غير موجود'
        WHEN CASE pi.purchase_type::text
               WHEN 'inventory' THEN v_inv
               WHEN 'asset' THEN v_fa
               WHEN 'government_fee' THEN v_gov
               ELSE v_opex END IS NULL THEN 'حساب المصروف/الأصل غير موجود'
        WHEN COALESCE(pi.deductible_vat_amount,0)>0 AND v_in_vat IS NULL
          THEN 'حساب ضريبة المدخلات غير موجود'
        WHEN COALESCE(pi.non_deductible_vat_amount,0)>0 AND v_nd_vat IS NULL
          THEN 'حساب الضريبة غير القابلة للخصم غير موجود'
        ELSE NULL
      END
    FROM public.purchase_invoices pi
    LEFT JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
    WHERE pi.status IN ('approved','partially_paid','paid')
      AND pi.issue_date BETWEEN p_from AND p_to

    UNION ALL
    -- (3) purchase_invoice_payment via finance_expenses (supplier direct payment)
    --     Trigger only posts when the invoice is approved and amounts match ±0.05.
    SELECT
      'purchase_invoice_payment'::text,
      fe.id::text,
      fe.expense_date,
      fe.amount::numeric,
      COALESCE(fs.name, fe.supplier_id::text),
      NULL::text,
      'purchase_invoice_payment'::text,
      fe.id::text,
      fe.amount::numeric,
      CASE
        WHEN v_ap IS NULL THEN NULL
        WHEN NOT COALESCE(pi_ok, false) THEN NULL
        WHEN NOT COALESCE(pi_approved, false) THEN NULL
        WHEN ABS(COALESCE(fe.amount,0) - COALESCE(pi_total,0)) > 0.05 THEN NULL
        WHEN owner_type = 'owner' AND v_dto IS NULL THEN NULL
        WHEN owner_type = 'company' AND v_cash IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object('account_id', v_ap, 'debit', fe.amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object(
              'account_id',
              CASE WHEN owner_type='owner' THEN v_dto ELSE v_cash END,
              'debit', 0, 'credit', fe.amount)
          ) t
        )
      END,
      CASE
        WHEN v_ap IS NULL THEN 'حساب الموردون غير موجود'
        WHEN NOT COALESCE(pi_ok, false) THEN 'الفاتورة المرتبطة مرفوضة أو غير موجودة'
        WHEN NOT COALESCE(pi_approved, false) THEN 'الفاتورة المرتبطة لم يُرحّل قيدها بعد'
        WHEN ABS(COALESCE(fe.amount,0) - COALESCE(pi_total,0)) > 0.05
          THEN 'مبلغ الدفعة لا يطابق إجمالي الفاتورة'
        WHEN owner_type='owner' AND v_dto IS NULL THEN 'حساب مستحقات المالك غير موجود'
        WHEN owner_type='company' AND v_cash IS NULL THEN 'حساب النقد والبنوك غير موجود'
        ELSE NULL
      END
    FROM public.finance_expenses fe
    LEFT JOIN public.finance_suppliers fs ON fs.id = fe.supplier_id
    LEFT JOIN LATERAL (
      SELECT pi.total_amount AS pi_total,
             (pi.status IS DISTINCT FROM 'rejected') AS pi_ok,
             EXISTS (
               SELECT 1 FROM public.journal_entries je
                WHERE je.source_type='purchase_invoice_approval'
                  AND je.source_id = pi.id::text
                  AND je.status = 'posted'
             ) AS pi_approved
      FROM public.purchase_invoices pi
      WHERE pi.id = fe.purchase_invoice_id
    ) pistat ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(fa.account_owner_type::text,
                      CASE WHEN fe.account_type='personal' THEN 'owner' ELSE 'company' END) AS owner_type
      FROM public.finance_accounts fa
      WHERE fa.id = fe.account_id
    ) fai ON true
    WHERE fe.deleted_at IS NULL
      AND fe.purchase_invoice_id IS NOT NULL
      AND fe.expense_date BETWEEN p_from AND p_to

    UNION ALL
    -- (4) purchase_invoice_payment via provider wallet (pipp:<payment_id>)
    SELECT
      'purchase_invoice_payment_wallet'::text,
      pipp.id::text,
      pipp.payment_date,
      pipp.amount::numeric,
      COALESCE(pv.name, ''),
      pv.provider_code::text,
      'purchase_invoice_payment'::text,
      'pipp:'||pipp.id::text,
      pipp.amount::numeric,
      CASE
        WHEN v_ap IS NULL THEN NULL
        WHEN pipp.source_account_id IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object('account_id', v_ap, 'debit', pipp.amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', pipp.source_account_id, 'debit', 0, 'credit', pipp.amount)
          ) t
        )
      END,
      CASE
        WHEN v_ap IS NULL THEN 'حساب الموردون غير موجود'
        WHEN pipp.source_account_id IS NULL THEN 'حساب المصدر (محفظة/وسيط) غير مربوط'
        ELSE NULL
      END
    FROM public.purchase_invoice_provider_payments pipp
    LEFT JOIN public.payment_providers pv ON pv.id = pipp.provider_id
    WHERE pipp.status = 'confirmed'
      AND pipp.payment_date BETWEEN p_from AND p_to

    UNION ALL
    -- (5) owner_withdrawal — two sub-branches inside trigger
    SELECT
      'owner_withdrawal'::text,
      fe.id::text,
      fe.expense_date,
      fe.amount::numeric,
      'المالك',
      NULL::text,
      'owner_withdrawal'::text,
      fe.id::text,
      fe.amount::numeric,
      CASE
        WHEN v_cash IS NULL THEN NULL
        WHEN branch = 'settlement' AND v_dto IS NULL THEN NULL
        WHEN branch = 'withdrawal' AND v_owner_draw IS NULL THEN NULL
        WHEN branch = 'none' THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object(
              'account_id', CASE WHEN branch='settlement' THEN v_dto ELSE v_owner_draw END,
              'debit', fe.amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', v_cash, 'debit', 0, 'credit', fe.amount)
          ) t
        )
      END,
      CASE
        WHEN v_cash IS NULL THEN 'حساب النقد والبنوك غير موجود'
        WHEN branch='settlement' AND v_dto IS NULL THEN 'حساب مستحقات المالك غير موجود'
        WHEN branch='withdrawal' AND v_owner_draw IS NULL THEN 'حساب سحوبات المالك غير موجود'
        WHEN branch='none' THEN 'العملية لا تنطبق على قواعد الترحيل الحالية'
        ELSE NULL
      END
    FROM public.finance_expenses fe
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN fe.business_relation = 'owner_settlement'
               AND COALESCE((SELECT fa.account_owner_type::text FROM public.finance_accounts fa WHERE fa.id=fe.account_id),
                            CASE WHEN fe.account_type='personal' THEN 'owner' ELSE 'company' END) = 'company'
            THEN 'settlement'
          WHEN fe.transaction_type = 'owner_withdrawal' THEN 'withdrawal'
          ELSE 'none'
        END AS branch
    ) b
    WHERE fe.deleted_at IS NULL
      AND fe.purchase_invoice_id IS NULL
      AND fe.expense_date BETWEEN p_from AND p_to
      AND (fe.transaction_type = 'owner_withdrawal'
           OR fe.business_relation = 'owner_settlement')

    UNION ALL
    -- (6) internal_transfer (outgoing leg) — trigger uses internal_transfer_clearing
    --     which is not in the current chart => almost always blocked_configuration.
    SELECT
      'internal_transfer_out'::text,
      fe.id::text,
      fe.expense_date,
      fe.amount::numeric,
      COALESCE(fa.name, 'حساب'),
      NULL::text,
      'internal_transfer'::text,
      fe.id::text,
      fe.amount::numeric,
      CASE
        WHEN v_itc IS NULL OR v_cash IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object('account_id', v_itc, 'debit', fe.amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', v_cash, 'debit', 0, 'credit', fe.amount)
          ) t
        )
      END,
      CASE
        WHEN v_itc IS NULL THEN 'حساب وسيط التحويلات الداخلية (internal_transfer_clearing) غير معرّف في دليل الحسابات'
        WHEN v_cash IS NULL THEN 'حساب النقد والبنوك غير موجود'
        ELSE NULL
      END
    FROM public.finance_expenses fe
    LEFT JOIN public.finance_accounts fa ON fa.id = fe.account_id
    WHERE fe.deleted_at IS NULL
      AND fe.transaction_type = 'internal_transfer_out'
      AND fe.expense_date BETWEEN p_from AND p_to

    UNION ALL
    -- (7) owner_contribution
    SELECT
      'owner_contribution'::text,
      fi.id::text,
      fi.income_date,
      fi.amount::numeric,
      'المالك',
      NULL::text,
      'owner_contribution'::text,
      fi.id::text,
      fi.amount::numeric,
      CASE
        WHEN v_cash IS NULL OR v_owner_cap IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object('account_id', v_cash, 'debit', fi.amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', v_owner_cap, 'debit', 0, 'credit', fi.amount)
          ) t
        )
      END,
      CASE
        WHEN v_cash IS NULL THEN 'حساب النقد والبنوك غير موجود'
        WHEN v_owner_cap IS NULL THEN 'حساب رأس المال غير موجود'
        ELSE NULL
      END
    FROM public.finance_incomes fi
    WHERE fi.deleted_at IS NULL
      AND fi.transaction_type = 'owner_contribution'
      AND fi.income_date BETWEEN p_from AND p_to

    UNION ALL
    -- (8) owner_reimbursement (income business_relation=owner_settlement, company account)
    SELECT
      'owner_reimbursement'::text,
      fi.id::text,
      fi.income_date,
      fi.amount::numeric,
      'المالك',
      NULL::text,
      'owner_reimbursement'::text,
      fi.id::text,
      fi.amount::numeric,
      CASE
        WHEN v_cash IS NULL OR v_dfo IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object('account_id', v_cash, 'debit', fi.amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', v_dfo, 'debit', 0, 'credit', fi.amount)
          ) t
        )
      END,
      CASE
        WHEN v_cash IS NULL THEN 'حساب النقد والبنوك غير موجود'
        WHEN v_dfo IS NULL THEN 'حساب ذمم على المالك غير موجود'
        ELSE NULL
      END
    FROM public.finance_incomes fi
    LEFT JOIN public.finance_accounts fa ON fa.id = fi.account_id
    WHERE fi.deleted_at IS NULL
      AND fi.business_relation = 'owner_settlement'
      AND COALESCE(fa.account_owner_type::text,
                   CASE WHEN fi.account_type='personal' THEN 'owner' ELSE 'company' END) = 'company'
      AND fi.income_date BETWEEN p_from AND p_to

    UNION ALL
    -- (9) sales_invoice_collection (direct via finance_incomes)
    SELECT
      'sales_invoice_collection_direct'::text,
      fi.id::text,
      fi.income_date,
      fi.amount::numeric,
      COALESCE(p.full_name, fi.customer_id::text),
      NULL::text,
      'sales_invoice_collection'::text,
      fi.id::text,
      fi.amount::numeric,
      CASE
        WHEN v_ar IS NULL THEN NULL
        WHEN owner_type='owner' AND v_dfo IS NULL THEN NULL
        WHEN owner_type='company' AND v_cash IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object(
              'account_id', CASE WHEN owner_type='owner' THEN v_dfo ELSE v_cash END,
              'debit', fi.amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', v_ar, 'debit', 0, 'credit', fi.amount)
          ) t
        )
      END,
      CASE
        WHEN v_ar IS NULL THEN 'حساب الذمم غير موجود'
        WHEN owner_type='owner' AND v_dfo IS NULL THEN 'حساب ذمم على المالك غير موجود'
        WHEN owner_type='company' AND v_cash IS NULL THEN 'حساب النقد والبنوك غير موجود'
        ELSE NULL
      END
    FROM public.finance_incomes fi
    LEFT JOIN public.profiles p ON p.id = fi.customer_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(fa.account_owner_type::text,
                      CASE WHEN fi.account_type='personal' THEN 'owner' ELSE 'company' END) AS owner_type
      FROM public.finance_accounts fa
      WHERE fa.id = fi.account_id
    ) o ON true
    WHERE fi.deleted_at IS NULL
      AND fi.transaction_type = 'customer_invoice_collection'
      AND fi.sales_invoice_id IS NOT NULL
      AND fi.income_date BETWEEN p_from AND p_to

    UNION ALL
    -- (10) sales_invoice_collection historical draft candidates
    --      Only invoices meeting the build_gateway_journal_drafts WHERE clause and
    --      that have NO direct customer_invoice_collection income yet.
    SELECT
      'sales_invoice_collection_gateway'::text,
      si.id::text,
      COALESCE(gw.entry_date, si.issue_date),
      si.total_amount::numeric,
      COALESCE(p.full_name, si.customer_id::text),
      gw.single_provider_code,
      'sales_invoice_collection'::text,
      si.id::text,
      si.total_amount::numeric,
      CASE
        WHEN v_ar IS NULL OR gw.clearing_account_id IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object('account_id', gw.clearing_account_id, 'debit', si.total_amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', v_ar, 'debit', 0, 'credit', si.total_amount)
          ) t
        )
      END,
      CASE
        WHEN v_ar IS NULL THEN 'حساب الذمم غير موجود'
        WHEN gw.clearing_account_id IS NULL THEN 'حساب وسيط ' || COALESCE(gw.single_provider_code,'?') || ' غير مربوط'
        ELSE NULL
      END
    FROM public.sales_invoices si
    LEFT JOIN public.profiles p ON p.id = si.customer_id
    JOIN LATERAL (
      SELECT
        (array_agg(DISTINCT pp.clearing_account_id))[1] AS clearing_account_id,
        MAX(pp.provider_code::text) AS single_provider_code,
        COUNT(DISTINCT pst.provider_id) AS provider_count,
        COALESCE(SUM(CASE WHEN psl.line_type IN ('sale','refund','partial_refund') THEN psl.amount END),0) AS net_amount,
        MAX(CASE WHEN psl.line_type IN ('sale','refund','partial_refund') THEN psl.transaction_date END) AS entry_date
      FROM public.payment_settlement_lines psl
      JOIN public.payment_settlements pst ON pst.id = psl.settlement_id
      JOIN public.payment_providers pp    ON pp.id  = pst.provider_id
      WHERE psl.sales_invoice_id = si.id
    ) gw ON true
    WHERE si.status IN ('approved','partially_paid','paid')
      AND si.issue_date BETWEEN p_from AND p_to
      AND gw.provider_count = 1
      AND gw.single_provider_code = si.payment_provider::text
      AND ABS(gw.net_amount - si.total_amount) <= 0.05
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_incomes fi
        WHERE fi.deleted_at IS NULL
          AND fi.transaction_type='customer_invoice_collection'
          AND fi.sales_invoice_id = si.id
      )

    UNION ALL
    -- (11) payment_settlement_payout (confirmed bank allocations)
    SELECT
      'payment_settlement_payout'::text,
      sba.id::text,
      fi.income_date,
      sba.allocated_amount::numeric,
      COALESCE(fa.name, 'بنك'),
      pp.provider_code::text,
      'payment_settlement_payout'::text,
      sba.id::text,
      sba.allocated_amount::numeric,
      CASE
        WHEN v_cash IS NULL OR pp.clearing_account_id IS NULL THEN NULL
        ELSE (
          SELECT jsonb_agg(x)
          FROM (
            SELECT jsonb_build_object('account_id', v_cash, 'debit', sba.allocated_amount, 'credit', 0) AS x
            UNION ALL
            SELECT jsonb_build_object('account_id', pp.clearing_account_id, 'debit', 0, 'credit', sba.allocated_amount)
          ) t
        )
      END,
      CASE
        WHEN v_cash IS NULL THEN 'حساب النقد والبنوك غير موجود'
        WHEN pp.clearing_account_id IS NULL THEN 'حساب وسيط ' || pp.provider_code::text || ' غير مربوط'
        ELSE NULL
      END
    FROM public.settlement_bank_allocations sba
    JOIN public.payment_settlements pst ON pst.id = sba.settlement_id
    JOIN public.payment_providers pp    ON pp.id  = pst.provider_id
    JOIN public.finance_incomes fi      ON fi.id  = sba.transaction_id
    LEFT JOIN public.finance_accounts fa ON fa.id = fi.account_id
    WHERE sba.status = 'confirmed'
      AND fi.deleted_at IS NULL
      AND fi.income_date BETWEEN p_from AND p_to
  ),
  matched AS (
    SELECT
      o.*,
      (
        SELECT COUNT(*)
        FROM public.journal_entries je2
        WHERE je2.source_type::text = o.expected_source_type
          AND je2.source_id = o.expected_source_id
          AND je2.status <> 'reversed'
      ) AS active_count,
      je.id AS existing_je_id,
      je.entry_number AS existing_je_number,
      je.status::text AS existing_status,
      je.entry_date AS existing_entry_date,
      je.total_debit AS existing_total,
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'account_id', jel.account_id,
                 'account_code', coa.code,
                 'account_name', coa.name_ar,
                 'system_key', coa.system_key,
                 'debit', jel.debit,
                 'credit', jel.credit,
                 'description', jel.description,
                 'line_order', jel.line_order
               ) ORDER BY jel.line_order), '[]'::jsonb)
        FROM public.journal_entry_lines jel
        LEFT JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
        WHERE jel.journal_entry_id = je.id
      ) AS existing_lines_full
    FROM ops o
    LEFT JOIN LATERAL (
      SELECT id, entry_number, status, entry_date, total_debit
      FROM public.journal_entries j
      WHERE j.source_type::text = o.expected_source_type
        AND j.source_id = o.expected_source_id
        AND j.status <> 'reversed'
      ORDER BY j.created_at DESC
      LIMIT 1
    ) je ON true
  ),
  sigs AS (
    SELECT
      m.*,
      -- normalized signatures: sorted (account_id, round(debit,2), round(credit,2))
      COALESCE((
        SELECT string_agg(
                 COALESCE(l->>'account_id','∅') || ':' ||
                 to_char(ROUND(COALESCE((l->>'debit')::numeric,0),2),'FM99999999990.00') || ':' ||
                 to_char(ROUND(COALESCE((l->>'credit')::numeric,0),2),'FM99999999990.00'),
                 '|'
                 ORDER BY COALESCE(l->>'account_id','∅'),
                          ROUND(COALESCE((l->>'debit')::numeric,0),2),
                          ROUND(COALESCE((l->>'credit')::numeric,0),2))
        FROM jsonb_array_elements(COALESCE(m.existing_lines_full,'[]'::jsonb)) l
      ),'') AS sig_exist,
      COALESCE((
        SELECT string_agg(
                 COALESCE(l->>'account_id','∅') || ':' ||
                 to_char(ROUND(COALESCE((l->>'debit')::numeric,0),2),'FM99999999990.00') || ':' ||
                 to_char(ROUND(COALESCE((l->>'credit')::numeric,0),2),'FM99999999990.00'),
                 '|'
                 ORDER BY COALESCE(l->>'account_id','∅'),
                          ROUND(COALESCE((l->>'debit')::numeric,0),2),
                          ROUND(COALESCE((l->>'credit')::numeric,0),2))
        FROM jsonb_array_elements(COALESCE(m.expected_lines,'[]'::jsonb)) l
      ),'') AS sig_exp
    FROM matched m
  )
  SELECT
    s.op_kind,
    s.op_id,
    s.op_date,
    s.op_amount,
    s.counterparty,
    s.provider_code,
    s.expected_source_type,
    s.expected_source_id,
    s.expected_total,
    s.expected_lines,
    s.existing_je_id,
    s.existing_je_number,
    s.existing_status,
    s.existing_entry_date,
    s.existing_total,
    s.existing_lines_full AS existing_lines,
    s.active_count,
    CASE
      WHEN s.blocked_reason IS NOT NULL AND s.existing_je_id IS NULL THEN 'blocked_configuration'
      WHEN s.existing_je_id IS NULL THEN 'missing'
      WHEN COALESCE(s.active_count,0) > 1 THEN 'duplicate'
      WHEN s.expected_lines IS NULL THEN 'blocked_configuration'
      WHEN s.op_date IS DISTINCT FROM s.existing_entry_date THEN 'mismatch'
      WHEN ABS(COALESCE(s.op_amount,0) - COALESCE(s.existing_total,0)) > 0.05 THEN 'mismatch'
      WHEN s.sig_exist IS DISTINCT FROM s.sig_exp THEN 'mismatch'
      WHEN s.existing_status = 'draft' THEN 'draft_pending'
      WHEN s.existing_status = 'posted' THEN 'correct'
      ELSE 'mismatch'
    END AS classification,
    CASE
      WHEN s.blocked_reason IS NOT NULL AND s.existing_je_id IS NULL THEN s.blocked_reason
      WHEN s.existing_je_id IS NULL THEN 'لا يوجد قيد لهذه العملية'
      WHEN COALESCE(s.active_count,0) > 1 THEN 'أكثر من قيد نشط لنفس المصدر (' || s.active_count || ')'
      WHEN s.expected_lines IS NULL THEN s.blocked_reason
      WHEN s.op_date IS DISTINCT FROM s.existing_entry_date
        THEN 'فرق تاريخ: عملية=' || s.op_date::text || ' | قيد=' || s.existing_entry_date::text
      WHEN ABS(COALESCE(s.op_amount,0) - COALESCE(s.existing_total,0)) > 0.05
        THEN 'فرق في المبلغ: عملية=' || s.op_amount::text || ' | قيد=' || COALESCE(s.existing_total,0)::text
      WHEN s.sig_exist IS DISTINCT FROM s.sig_exp THEN 'فرق في السطور/الحسابات'
      WHEN s.existing_status = 'draft' THEN 'مسودة مطابقة بانتظار الاعتماد'
      ELSE NULL
    END AS diff_reason,
    s.blocked_reason
  FROM sigs s;
END
$fn$;

REVOKE ALL ON FUNCTION public.finance_posting_scan_all(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_posting_scan_all(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.finance_posting_scan_all(date, date) IS
'Read-only. Full classified rows for the posting review. Called by the paginated wrapper and the summary.';


-- ---------------------------------------------------------------------------
-- 2) Paginated wrapper with filters and total row count.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_posting_scan(
  p_from   date,
  p_to     date,
  p_limit  integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_kind   text    DEFAULT NULL,
  p_class  text    DEFAULT NULL
)
RETURNS TABLE (
  op_kind              text,
  op_id                text,
  op_date              date,
  op_amount            numeric,
  counterparty         text,
  provider_code        text,
  expected_source_type text,
  expected_source_id   text,
  expected_total       numeric,
  expected_lines       jsonb,
  existing_je_id       uuid,
  existing_je_number   text,
  existing_status      text,
  existing_entry_date  date,
  existing_total       numeric,
  existing_lines       jsonb,
  classification       text,
  diff_reason          text,
  blocked_reason       text,
  total_count          bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE
  v_limit  int := COALESCE(NULLIF(p_limit,0), 100);
  v_offset int := COALESCE(p_offset, 0);
BEGIN
  IF v_limit <= 0 OR v_limit > 500 THEN v_limit := 100; END IF;
  IF v_offset < 0 THEN v_offset := 0; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT * FROM public.finance_posting_scan_all(p_from, p_to)
    WHERE (p_kind  IS NULL OR op_kind = p_kind)
      AND (p_class IS NULL OR classification = p_class)
  ),
  windowed AS (
    SELECT b.*, COUNT(*) OVER () AS total_count FROM base b
  )
  SELECT
    w.op_kind, w.op_id, w.op_date, w.op_amount, w.counterparty, w.provider_code,
    w.expected_source_type, w.expected_source_id, w.expected_total, w.expected_lines,
    w.existing_je_id, w.existing_je_number, w.existing_status, w.existing_entry_date,
    w.existing_total, w.existing_lines,
    w.classification, w.diff_reason, w.blocked_reason,
    w.total_count
  FROM windowed w
  ORDER BY w.op_date DESC, w.op_kind, w.op_id
  LIMIT v_limit OFFSET v_offset;
END
$fn$;

REVOKE ALL ON FUNCTION public.finance_posting_scan(date, date, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_posting_scan(date, date, integer, integer, text, text) TO authenticated, service_role;

-- The old zero-extra-arg signature is kept working via the DEFAULTs above.
-- Drop the earlier 2-arg alias so PostgREST resolves the new one unambiguously.
DROP FUNCTION IF EXISTS public.finance_posting_scan(date, date);

COMMENT ON FUNCTION public.finance_posting_scan(date, date, integer, integer, text, text) IS
'Read-only. Paginated view of the posting review with optional op_kind/classification filters and total_count.';


-- ---------------------------------------------------------------------------
-- 3) Summary aggregates over the FULL (unfiltered, unpaginated) set.
-- ---------------------------------------------------------------------------
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $fn$
BEGIN
  RETURN QUERY
  SELECT s.op_kind, s.classification, COUNT(*)::bigint,
         COALESCE(SUM(s.op_amount),0)::numeric
  FROM public.finance_posting_scan_all(p_from, p_to) s
  GROUP BY s.op_kind, s.classification
  ORDER BY s.op_kind, s.classification;
END
$fn$;

REVOKE ALL ON FUNCTION public.finance_posting_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_posting_summary(date, date) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 4) Account readiness — read-only configuration report.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_posting_account_readiness()
RETURNS TABLE (
  slot         text,
  label        text,
  category     text,
  present      boolean,
  detail       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (
       private.has_role(v_uid, 'admin'::app_role)
    OR private.has_role(v_uid, 'finance_manage'::app_role)
    OR private.has_role(v_uid, 'finance_accountant'::app_role)
  ) THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  -- Required system-key chart accounts
  SELECT k.key, k.lbl, 'chart_account'::text,
         (coa.id IS NOT NULL),
         CASE WHEN coa.id IS NOT NULL THEN coa.code || ' — ' || coa.name_ar
              ELSE 'غير معرّف في دليل الحسابات' END
  FROM (VALUES
    ('cash_bank',                  'النقد والبنوك'),
    ('accounts_receivable',        'الذمم المدينة'),
    ('accounts_payable',           'الموردون'),
    ('sales_revenue',              'المبيعات'),
    ('output_vat_payable',         'ضريبة المخرجات'),
    ('input_vat_deductible',       'ضريبة المدخلات القابلة للخصم'),
    ('non_deductible_vat_expense', 'ضريبة غير قابلة للخصم'),
    ('inventory',                  'المخزون'),
    ('fixed_assets',               'الأصول الثابتة'),
    ('operating_expense',          'مصروفات تشغيلية'),
    ('government_fees',            'رسوم حكومية'),
    ('owner_capital',              'رأس مال المالك'),
    ('owner_drawings',             'سحوبات المالك'),
    ('due_to_owner',               'مستحقات للمالك'),
    ('due_from_owner',             'ذمم على المالك'),
    ('internal_transfer_clearing', 'وسيط تحويلات داخلية'),
    ('clearing_salla',             'وسيط سلة'),
    ('clearing_tabby',             'وسيط تابي'),
    ('clearing_tamara',            'وسيط تمارا'),
    ('wallet_salla',               'محفظة سلة')
  ) AS k(key, lbl)
  LEFT JOIN public.chart_of_accounts coa ON coa.system_key = k.key

  UNION ALL
  -- Provider mappings
  SELECT 'provider_clearing:'||pp.provider_code::text,
         'حساب وسيط ' || pp.name,
         'provider_mapping',
         (pp.clearing_account_id IS NOT NULL),
         CASE WHEN pp.clearing_account_id IS NOT NULL
              THEN (SELECT code || ' — ' || name_ar FROM public.chart_of_accounts WHERE id = pp.clearing_account_id)
              ELSE 'غير مربوط' END
  FROM public.payment_providers pp

  UNION ALL
  SELECT 'provider_wallet:'||pp.provider_code::text,
         'حساب محفظة ' || pp.name,
         'provider_mapping',
         (pp.wallet_account_id IS NOT NULL),
         CASE WHEN pp.wallet_account_id IS NOT NULL
              THEN (SELECT code || ' — ' || name_ar FROM public.chart_of_accounts WHERE id = pp.wallet_account_id)
              ELSE 'اختياري — لم يُربط بعد' END
  FROM public.payment_providers pp

  UNION ALL
  -- Finance-account presence (bank vs personal)
  SELECT 'finance_account:company_bank', 'حسابات بنكية للمنشأة', 'finance_account',
         EXISTS (SELECT 1 FROM public.finance_accounts WHERE account_owner_type='company' AND account_kind='bank' AND is_active),
         (SELECT COALESCE(string_agg(name, '، '), 'لا يوجد')
            FROM public.finance_accounts
           WHERE account_owner_type='company' AND account_kind='bank' AND is_active)
  UNION ALL
  SELECT 'finance_account:cash', 'حساب صندوق نقدي', 'finance_account',
         EXISTS (SELECT 1 FROM public.finance_accounts WHERE account_kind='cash' AND is_active),
         (SELECT COALESCE(string_agg(name, '، '), 'لا يوجد')
            FROM public.finance_accounts
           WHERE account_kind='cash' AND is_active)
  UNION ALL
  SELECT 'finance_account:owner_personal', 'حساب شخصي للمالك', 'finance_account',
         EXISTS (SELECT 1 FROM public.finance_accounts WHERE account_owner_type='owner' AND is_active),
         (SELECT COALESCE(string_agg(name, '، '), 'لا يوجد')
            FROM public.finance_accounts
           WHERE account_owner_type='owner' AND is_active)

  ORDER BY 3, 1;
END
$fn$;

REVOKE ALL ON FUNCTION public.finance_posting_account_readiness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_posting_account_readiness() TO authenticated, service_role;

COMMENT ON FUNCTION public.finance_posting_account_readiness() IS
'Read-only configuration report — which chart accounts and provider mappings the posting scanner needs and whether they exist.';
