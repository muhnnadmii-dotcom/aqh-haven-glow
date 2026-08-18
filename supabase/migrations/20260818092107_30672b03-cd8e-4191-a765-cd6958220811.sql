
-- Central payment-method normalization (display + grouping)
CREATE OR REPLACE FUNCTION public.normalize_payment_method(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH c AS (
    SELECT NULLIF(btrim(regexp_replace(COALESCE(p_raw,''), '^[\s''"`]+|[\s''"`]+$', '', 'g')), '') AS v
  )
  SELECT CASE
    WHEN v IS NULL OR v = '\N' OR upper(v) = 'N/A' THEN 'غير محدد'
    WHEN v ILIKE '%tamara%' OR v LIKE '%تمارا%' THEN 'تمارا'
    WHEN v ILIKE '%tabby%'  OR v LIKE '%تابي%'  THEN 'تابي'
    WHEN v ILIKE '%apple%'  THEN 'Apple Pay'
    WHEN v ILIKE '%stc%'    OR v LIKE '%اس تي سي%' THEN 'STC Pay'
    WHEN v ILIKE '%mada%'   OR v LIKE '%مدى%'   THEN 'مدى'
    WHEN v ILIKE '%visa%' OR v ILIKE '%master%' OR v ILIKE '%credit%'
      OR v LIKE '%البطاقة الائتمانية%' OR v LIKE '%بطاقة ائتمان%' THEN 'البطاقة الائتمانية'
    WHEN v ILIKE '%bank%transfer%' OR v ILIKE '%bank_transfer%' OR v LIKE '%تحويل بنكي%'
      OR v LIKE '%حوالة%' OR v ILIKE '%iban%' THEN 'تحويل بنكي'
    WHEN v ILIKE '%wallet%' OR v LIKE '%محفظة%' THEN 'محفظة العميل'
    WHEN v ILIKE '%free%' OR v LIKE '%مجان%' THEN 'مجاني'
    ELSE 'أخرى'
  END
  FROM c;
$$;

REVOKE ALL ON FUNCTION public.normalize_payment_method(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_payment_method(text) TO authenticated, service_role;

-- Unified read-only aggregation for the finance overview dashboard
CREATE OR REPLACE FUNCTION public.finance_overview(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days int;
  v_pfrom date; v_pto date;
  v_owner_cat uuid;
  v_delivery_cat uuid;
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (private.has_role(v_uid,'admin')
          OR private.has_role(v_uid,'finance_manage')
          OR private.has_role(v_uid,'finance_view')
          OR private.has_role(v_uid,'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_days := GREATEST((p_to - p_from) + 1, 1);
  v_pto := p_from - 1;
  v_pfrom := v_pto - (v_days - 1);

  SELECT id INTO v_owner_cat FROM public.finance_categories WHERE system_slug = 'owner_draw' LIMIT 1;
  SELECT id INTO v_delivery_cat FROM public.finance_categories WHERE kind='main' AND name = 'Delivery' LIMIT 1;

  WITH
  -- ---------- cash movements ----------
  inc AS (
    SELECT * FROM public.finance_incomes
    WHERE deleted_at IS NULL AND account_type <> 'personal'
      AND COALESCE(transaction_type::text,'') NOT IN ('owner_contribution','internal_transfer_in','loan_received')
  ),
  exp AS (
    SELECT * FROM public.finance_expenses
    WHERE deleted_at IS NULL AND account_type <> 'personal'
  ),
  op_exp AS (
    SELECT * FROM exp
    WHERE (v_owner_cat IS NULL OR main_category_id IS DISTINCT FROM v_owner_cat)
      AND COALESCE(transaction_type::text,'') NOT IN
          ('owner_withdrawal','owner_reimbursement','internal_transfer_out','loan_payment')
  ),
  draws AS (
    SELECT * FROM exp
    WHERE transaction_type::text = 'owner_withdrawal'
       OR (v_owner_cat IS NOT NULL AND main_category_id = v_owner_cat)
  ),
  cash AS (
    SELECT
      (SELECT COALESCE(SUM(amount),0) FROM inc WHERE income_date BETWEEN p_from AND p_to) AS collected,
      (SELECT COALESCE(SUM(amount),0) FROM inc WHERE income_date BETWEEN v_pfrom AND v_pto) AS prev_collected,
      (SELECT COALESCE(SUM(amount),0) FROM op_exp WHERE expense_date BETWEEN p_from AND p_to) AS op_expenses,
      (SELECT COALESCE(SUM(amount),0) FROM op_exp WHERE expense_date BETWEEN v_pfrom AND v_pto) AS prev_op_expenses,
      (SELECT COALESCE(SUM(amount),0) FROM draws WHERE expense_date BETWEEN p_from AND p_to) AS owner_draws,
      (SELECT COALESCE(SUM(amount),0) FROM draws WHERE expense_date BETWEEN v_pfrom AND v_pto) AS prev_owner_draws
  ),
  bank AS (
    SELECT COALESCE(SUM(
      COALESCE(a.opening_balance,0)
      + COALESCE((SELECT SUM(i.amount) FROM public.finance_incomes i
                  WHERE i.deleted_at IS NULL AND i.account_id = a.id AND i.account_type <> 'personal'
                    AND (a.opening_balance_date IS NULL OR i.income_date > a.opening_balance_date)),0)
      - COALESCE((SELECT SUM(e.amount) FROM public.finance_expenses e
                  WHERE e.deleted_at IS NULL AND e.account_id = a.id AND e.account_type <> 'personal'
                    AND (a.opening_balance_date IS NULL OR e.expense_date > a.opening_balance_date)),0)
    ),0) AS bank_balance
    FROM public.finance_accounts a
    WHERE a.include_in_company_cash_balance
  ),
  -- ---------- sales base ----------
  si AS (
    SELECT
      s.*,
      COALESCE(NULLIF(s.total_amount,0), s.original_gross_amount, 0) AS eff_total,
      COALESCE(NULLIF(s.external_order_id,''), 'inv:'||s.id::text) AS order_key,
      COALESCE(s.customer_id::text,
               NULLIF(regexp_replace(COALESCE(s.customer_phone_snapshot,''),'\D','','g'),''),
               NULLIF(btrim(COALESCE(s.customer_name_snapshot,'')),''),
               'inv:'||s.id::text) AS customer_key,
      public.normalize_payment_method(s.original_payment_method) AS pay_method,
      public.normalize_shipping_company(s.shipping_company) AS ship_co
    FROM public.sales_invoices s
    WHERE s.status <> 'cancelled'
  ),
  cur AS (SELECT * FROM si WHERE issue_date BETWEEN p_from AND p_to),
  prv AS (SELECT * FROM si WHERE issue_date BETWEEN v_pfrom AND v_pto),
  first_seen AS (
    SELECT customer_key, MIN(issue_date) AS first_date FROM si GROUP BY customer_key
  ),
  sales_tot AS (
    SELECT
      (SELECT COALESCE(SUM(eff_total),0) FROM cur) AS total_sales,
      (SELECT COALESCE(SUM(eff_total),0) FROM prv) AS prev_total_sales
  ),
  -- ---------- gateways ----------
  gw AS (
    SELECT
      COALESCE(pp.name, 'غير محدد') AS provider_name,
      pp.provider_code::text AS provider_code,
      SUM(COALESCE(ps.gross_sales_amount,0)) AS gross_sales_amount,
      SUM(COALESCE(ps.refunds_amount,0)) AS refunds_amount,
      SUM(COALESCE(ps.fees_before_vat,0)) AS fees_before_vat,
      SUM(COALESCE(ps.fees_vat_amount,0)) AS fees_vat_amount,
      SUM(COALESCE(ps.payout_fee,0)) AS payout_fee,
      SUM(COALESCE(ps.other_deductions,0)) AS other_deductions,
      SUM(COALESCE(ps.expected_net_amount,0)) AS expected_net_amount,
      SUM(COALESCE(ps.actual_bank_amount,0)) AS actual_bank_amount,
      SUM(COALESCE(ps.difference_amount,0)) AS difference_amount,
      SUM(CASE WHEN ps.payout_status::text = 'awaiting_payout'
               THEN COALESCE(ps.expected_net_amount,0) ELSE 0 END) AS pending_amount,
      COUNT(*) AS settlements_count
    FROM public.payment_settlements ps
    LEFT JOIN public.payment_providers pp ON pp.id = ps.provider_id
    WHERE ps.settlement_date BETWEEN p_from AND p_to
      AND ps.status::text <> 'cancelled'
    GROUP BY 1,2
  ),
  gw_prev AS (
    SELECT COALESCE(SUM(COALESCE(fees_before_vat,0)+COALESCE(fees_vat_amount,0)
                        +COALESCE(payout_fee,0)+COALESCE(other_deductions,0)),0) AS cost
    FROM public.payment_settlements
    WHERE settlement_date BETWEEN v_pfrom AND v_pto AND status::text <> 'cancelled'
  ),
  -- ---------- shipping ----------
  ship AS (
    SELECT
      COALESCE(public.normalize_shipping_company(o.shipping_company), 'غير محدد') AS company,
      o.order_status,
      CASE
        WHEN o.order_status ~* 'cancel|ملغى|ملغي|ملغاة' THEN 'cancelled'
        WHEN o.order_status ~* 'delivered|تم التوصيل' THEN 'delivered'
        ELSE 'active'
      END AS bucket,
      COALESCE(inv.shipping_before_vat,0) + COALESCE(inv.shipping_vat,0) AS ship_value
    FROM public.salla_orders o
    LEFT JOIN LATERAL (
      SELECT s.shipping_before_vat, s.shipping_vat
      FROM public.sales_invoices s
      WHERE s.external_order_id = o.external_order_id
      ORDER BY s.id DESC LIMIT 1
    ) inv ON true
    WHERE o.order_date BETWEEN p_from AND p_to
  ),
  ship_expenses AS (
    SELECT COALESCE(SUM(amount),0) AS total
    FROM public.finance_expenses
    WHERE deleted_at IS NULL AND expense_date BETWEEN p_from AND p_to
      AND v_delivery_cat IS NOT NULL AND main_category_id = v_delivery_cat
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'prev_from', v_pfrom, 'prev_to', v_pto),
    'kpis', (
      SELECT jsonb_build_object(
        'bank_balance', (SELECT bank_balance FROM bank),
        'total_sales', st.total_sales,
        'prev_total_sales', st.prev_total_sales,
        'collected', c.collected,
        'prev_collected', c.prev_collected,
        'operating_expenses', c.op_expenses,
        'prev_operating_expenses', c.prev_op_expenses,
        'net_operating_cash', c.collected - c.op_expenses,
        'prev_net_operating_cash', c.prev_collected - c.prev_op_expenses,
        'gateway_cost', (SELECT COALESCE(SUM(fees_before_vat+fees_vat_amount+payout_fee+other_deductions),0) FROM gw),
        'prev_gateway_cost', (SELECT cost FROM gw_prev),
        'owner_draws', c.owner_draws,
        'prev_owner_draws', c.prev_owner_draws,
        'inventory_value', (SELECT COALESCE(inventory_value,0) FROM public.aqh_finance_manual_balances LIMIT 1),
        'assets_value', (SELECT COALESCE(assets_value,0) FROM public.aqh_finance_manual_balances LIMIT 1)
      )
      FROM cash c, sales_tot st
    ),
    'payment_methods', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'sales')::numeric DESC) FROM (
        SELECT jsonb_build_object(
          'method', pay_method,
          'orders', COUNT(DISTINCT order_key),
          'customers', COUNT(DISTINCT customer_key),
          'sales', ROUND(SUM(eff_total),2),
          'avg_order', ROUND(SUM(eff_total)/NULLIF(COUNT(DISTINCT order_key),0),2)
        ) AS x
        FROM cur GROUP BY pay_method
      ) t
    ), '[]'::jsonb),
    'gateways', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'provider', provider_name,
        'provider_code', provider_code,
        'settlements_count', settlements_count,
        'gross_sales_amount', ROUND(gross_sales_amount,2),
        'refunds_amount', ROUND(refunds_amount,2),
        'fees_before_vat', ROUND(fees_before_vat,2),
        'fees_vat_amount', ROUND(fees_vat_amount,2),
        'payout_fee', ROUND(payout_fee,2),
        'other_deductions', ROUND(other_deductions,2),
        'total_cost', ROUND(fees_before_vat+fees_vat_amount+payout_fee+other_deductions,2),
        'cost_ratio', ROUND(100*(fees_before_vat+fees_vat_amount+payout_fee+other_deductions)
                            /NULLIF(gross_sales_amount,0),2),
        'expected_net_amount', ROUND(expected_net_amount,2),
        'actual_bank_amount', ROUND(actual_bank_amount,2),
        'pending_amount', ROUND(pending_amount,2),
        'difference_amount', ROUND(difference_amount,2)
      ) ORDER BY gross_sales_amount DESC) FROM gw
    ), '[]'::jsonb),
    'sales_health', (
      SELECT jsonb_build_object(
        'orders', (SELECT COUNT(DISTINCT order_key) FROM cur),
        'customers', (SELECT COUNT(DISTINCT customer_key) FROM cur),
        'new_customers', (SELECT COUNT(*) FROM (
            SELECT c.customer_key FROM cur c JOIN first_seen f USING (customer_key)
            GROUP BY c.customer_key, f.first_date HAVING f.first_date >= p_from) a),
        'returning_customers', (SELECT COUNT(*) FROM (
            SELECT c.customer_key FROM cur c JOIN first_seen f USING (customer_key)
            GROUP BY c.customer_key, f.first_date HAVING f.first_date < p_from) b),
        'avg_order', (SELECT ROUND(COALESCE(SUM(eff_total),0)/NULLIF(COUNT(DISTINCT order_key),0),2) FROM cur),
        'median_order', (SELECT ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY eff_total),0)::numeric,2) FROM cur),
        'discounts', (SELECT ROUND(COALESCE(SUM(discount_amount),0),2) FROM cur),
        'refunds', (SELECT ROUND(COALESCE(SUM(refund_amount),0),2) FROM cur),
        'shipping_collected', (SELECT ROUND(COALESCE(SUM(COALESCE(shipping_before_vat,0)+COALESCE(shipping_vat,0)),0),2) FROM cur),
        'cancelled_orders', (SELECT COUNT(*) FROM public.salla_orders o
                             WHERE o.order_date BETWEEN p_from AND p_to
                               AND o.order_status ~* 'cancel|ملغى|ملغي|ملغاة'),
        'cancelled_value', (SELECT ROUND(COALESCE(SUM(o.original_total),0),2) FROM public.salla_orders o
                             WHERE o.order_date BETWEEN p_from AND p_to
                               AND o.order_status ~* 'cancel|ملغى|ملغي|ملغاة'),
        'partial_payments', (SELECT COUNT(*) FROM cur
                             WHERE payment_status::text='partially_paid'
                               AND COALESCE(paid_amount,0) > 0 AND COALESCE(remaining_amount,0) > 0),
        'partial_payments_amount', (SELECT ROUND(COALESCE(SUM(remaining_amount),0),2) FROM cur
                             WHERE payment_status::text='partially_paid'
                               AND COALESCE(paid_amount,0) > 0 AND COALESCE(remaining_amount,0) > 0),
        'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'sales', v) ORDER BY d) FROM (
            SELECT issue_date AS d, ROUND(SUM(eff_total),2) AS v FROM cur GROUP BY issue_date) q), '[]'::jsonb),
        'prev_daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'sales', v) ORDER BY d) FROM (
            SELECT issue_date AS d, ROUND(SUM(eff_total),2) AS v FROM prv GROUP BY issue_date) q2), '[]'::jsonb)
      )
    ),
    'discount_codes', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'sales')::numeric DESC) FROM (
        SELECT jsonb_build_object(
          'code', discount_code,
          'orders', COUNT(DISTINCT order_key),
          'customers', COUNT(DISTINCT customer_key),
          'sales', ROUND(SUM(eff_total),2),
          'discount_value', ROUND(COALESCE(SUM(discount_amount),0),2),
          'avg_order', ROUND(SUM(eff_total)/NULLIF(COUNT(DISTINCT order_key),0),2),
          'refunds', ROUND(COALESCE(SUM(refund_amount),0),2),
          'net_sales', ROUND(SUM(eff_total) - COALESCE(SUM(refund_amount),0),2),
          'new_customers', COUNT(DISTINCT customer_key) FILTER (
            WHERE customer_key IN (SELECT customer_key FROM first_seen WHERE first_date >= p_from))
        ) AS x
        FROM cur
        WHERE NULLIF(btrim(COALESCE(discount_code,'')),'') IS NOT NULL
        GROUP BY discount_code
      ) t
    ), '[]'::jsonb),
    'shipping', jsonb_build_object(
      'has_data', (SELECT EXISTS (SELECT 1 FROM ship WHERE company <> 'غير محدد')),
      'expenses_total', (SELECT total FROM ship_expenses),
      'collected_total', (SELECT ROUND(COALESCE(SUM(ship_value),0),2) FROM ship WHERE bucket <> 'cancelled'),
      'companies', COALESCE((
        SELECT jsonb_agg(x ORDER BY (x->>'orders')::int DESC) FROM (
          SELECT jsonb_build_object(
            'company', company,
            'orders', COUNT(*),
            'delivered', COUNT(*) FILTER (WHERE bucket='delivered'),
            'active', COUNT(*) FILTER (WHERE bucket='active'),
            'cancelled', COUNT(*) FILTER (WHERE bucket='cancelled'),
            'shipping_collected', ROUND(COALESCE(SUM(ship_value) FILTER (WHERE bucket <> 'cancelled'),0),2),
            'avg_shipping', ROUND(COALESCE(SUM(ship_value) FILTER (WHERE bucket <> 'cancelled'),0)
                                  /NULLIF(COUNT(*) FILTER (WHERE bucket <> 'cancelled'),0),2)
          ) AS x
          FROM ship GROUP BY company
        ) t
      ), '[]'::jsonb)
    )
  ) INTO v_out;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_overview(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_overview(date, date) TO authenticated, service_role;
