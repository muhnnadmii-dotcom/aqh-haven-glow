-- 1) Central normalizers -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_norm_phone(p_raw text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $fn$
  SELECT NULLIF(RIGHT(regexp_replace(COALESCE(p_raw,''), '\D', '', 'g'), 9), '');
$fn$;

CREATE OR REPLACE FUNCTION public.finance_norm_name(p_raw text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $fn$
  SELECT NULLIF(btrim(regexp_replace(
    translate(
      lower(COALESCE(p_raw,'')),
      'أإآٱىئؤةًٌٍَُِّْ.,-_/\|()[]{}''"`*#@!?:;',
      'اااايياه                                '
    ),
    '\s+', ' ', 'g')), '');
$fn$;

-- 2) Unified customer-transfer link status -----------------------------------
CREATE OR REPLACE VIEW public.finance_customer_transfer_status
WITH (security_invoker = on) AS
WITH base AS (
  SELECT i.id, i.income_date, i.amount, i.note, i.customer_id, i.sales_invoice_id,
         i.account_type::text AS account_type,
         i.transaction_type::text AS tt,
         i.collection_type::text AS ct
  FROM public.finance_incomes i
  WHERE i.deleted_at IS NULL
    AND i.business_relation::text = 'business'
    AND i.payment_provider_id IS NULL
    AND i.settlement_id IS NULL
    AND COALESCE(i.transaction_type::text,'') NOT IN
        ('payment_provider_settlement','internal_transfer_in','owner_contribution',
         'owner_collection','loan_received','supplier_refund','customer_refund')
    AND ( i.transaction_type::text IN ('customer_invoice_collection','customer_advance','direct_sale')
       OR i.collection_type::text IN ('invoice_collection','advance_payment') )
), ident AS (
  SELECT b.*,
    public.finance_norm_name(COALESCE(p.full_name, b.note)) AS id_name,
    COALESCE(public.finance_norm_phone(p.phone),
             public.finance_norm_phone(b.note))            AS id_phone,
    public.finance_norm_name(b.note)                        AS note_name,
    regexp_replace(COALESCE(b.note,''), '\D', '', 'g')      AS note_digits
  FROM base b
  LEFT JOIN public.profiles p ON p.id = b.customer_id
), joined AS (
  SELECT e.*, inv.id AS inv_id, inv.invoice_number, inv.status::text AS inv_status,
         inv.sales_channel::text AS inv_channel
  FROM ident e
  LEFT JOIN public.sales_invoices inv ON inv.id = e.sales_invoice_id
)
SELECT
  j.id AS income_id,
  j.income_date,
  j.amount,
  j.note,
  j.account_type,
  j.tt AS transaction_type,
  j.ct AS collection_type,
  j.sales_invoice_id,
  j.invoice_number,
  j.inv_status,
  j.inv_channel,
  d.dup_count,
  CASE
    WHEN j.inv_id IS NOT NULL AND j.inv_status <> 'cancelled' AND j.inv_channel = 'manual'
         AND COALESCE(d.dup_count,0) > 0 THEN 'suspected_duplicate'
    WHEN j.inv_id IS NOT NULL AND j.inv_status <> 'cancelled' THEN 'linked'
    WHEN j.tt = 'customer_advance' OR j.ct = 'advance_payment' THEN 'advance_pending'
    ELSE 'unlinked'
  END AS link_state
FROM joined j
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS dup_count
  FROM public.sales_invoices s
  WHERE s.sales_channel::text = 'salla'
    AND s.status::text <> 'cancelled'
    AND public.normalize_payment_method(s.original_payment_method) = 'تحويل بنكي'
    AND ABS(COALESCE(NULLIF(s.total_amount,0), s.original_gross_amount, 0) - j.amount) <= 0.05
    AND s.issue_date BETWEEN (j.income_date - 7) AND (j.income_date + 7)
    AND (
      ( public.finance_norm_phone(s.customer_phone_snapshot) IS NOT NULL
        AND ( public.finance_norm_phone(s.customer_phone_snapshot) = j.id_phone
              OR position(public.finance_norm_phone(s.customer_phone_snapshot) in j.note_digits) > 0 ) )
      OR
      ( public.finance_norm_name(s.customer_name_snapshot) IS NOT NULL
        AND length(public.finance_norm_name(s.customer_name_snapshot)) >= 5
        AND ( public.finance_norm_name(s.customer_name_snapshot) = j.id_name
              OR position(public.finance_norm_name(s.customer_name_snapshot) in COALESCE(j.note_name,'')) > 0 ) )
    )
) d ON TRUE;

GRANT SELECT ON public.finance_customer_transfer_status TO authenticated;

-- 3) Summary used by the overview aggregation layer --------------------------
CREATE OR REPLACE FUNCTION public.finance_customer_transfers_summary(p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (private.has_role(v_uid,'admin') OR private.has_role(v_uid,'finance_manage')
          OR private.has_role(v_uid,'finance_view') OR private.has_role(v_uid,'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'count', COUNT(*),
    'amount', ROUND(COALESCE(SUM(amount),0),2),
    'oldest_date', MIN(income_date),
    'oldest_age_days', COALESCE(MAX(CURRENT_DATE - income_date),0),
    'unlinked_count', COUNT(*) FILTER (WHERE link_state='unlinked'),
    'unlinked_amount', ROUND(COALESCE(SUM(amount) FILTER (WHERE link_state='unlinked'),0),2),
    'advance_pending_count', COUNT(*) FILTER (WHERE link_state='advance_pending'),
    'advance_pending_amount', ROUND(COALESCE(SUM(amount) FILTER (WHERE link_state='advance_pending'),0),2),
    'suspected_duplicate_count', COUNT(*) FILTER (WHERE link_state='suspected_duplicate'),
    'suspected_duplicate_amount', ROUND(COALESCE(SUM(amount) FILTER (WHERE link_state='suspected_duplicate'),0),2)
  ) INTO v_out
  FROM public.finance_customer_transfer_status
  WHERE link_state <> 'linked';

  RETURN COALESCE(v_out, '{}'::jsonb);
END $fn$;

REVOKE ALL ON FUNCTION public.finance_customer_transfers_summary(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_customer_transfers_summary(date,date) TO authenticated;

-- 4) Inject the block into the existing finance_overview payload (idempotent)
DO $do$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='finance_overview';

  IF d IS NOT NULL AND position('customer_transfers' in d) = 0 THEN
    d := replace(
      d,
      E'    ''shipping'', jsonb_build_object(',
      E'    ''customer_transfers'', public.finance_customer_transfers_summary(p_from, p_to),\n    ''shipping'', jsonb_build_object('
    );
    EXECUTE d;
  END IF;
END $do$;

-- 5) Link suggestions (read-only, never auto-links) --------------------------
CREATE OR REPLACE FUNCTION public.finance_customer_transfer_suggestions(p_income_id uuid)
RETURNS TABLE (
  invoice_id bigint, invoice_number text, issue_date date, customer_name text,
  total_amount numeric, remaining_amount numeric, payment_method text,
  score int, confidence text, reason text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_inc RECORD;
  v_phone text; v_name text; v_digits text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (private.has_role(v_uid,'admin') OR private.has_role(v_uid,'finance_manage')
          OR private.has_role(v_uid,'finance_view') OR private.has_role(v_uid,'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT i.id, i.income_date, i.amount, i.note, i.customer_id
    INTO v_inc FROM public.finance_incomes i WHERE i.id = p_income_id AND i.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(public.finance_norm_phone(p.phone), public.finance_norm_phone(v_inc.note)),
         public.finance_norm_name(COALESCE(p.full_name, v_inc.note))
    INTO v_phone, v_name
  FROM (SELECT 1) z LEFT JOIN public.profiles p ON p.id = v_inc.customer_id;

  v_digits := regexp_replace(COALESCE(v_inc.note,''), '\D', '', 'g');

  RETURN QUERY
  WITH cand AS (
    SELECT s.id, s.invoice_number, s.issue_date, s.customer_name_snapshot,
           COALESCE(NULLIF(s.total_amount,0), s.original_gross_amount, 0) AS eff_total,
           GREATEST(COALESCE(s.remaining_amount,0),0) AS rem,
           public.normalize_payment_method(s.original_payment_method) AS pm,
           ( public.finance_norm_phone(s.customer_phone_snapshot) IS NOT NULL
             AND ( public.finance_norm_phone(s.customer_phone_snapshot) = v_phone
                   OR position(public.finance_norm_phone(s.customer_phone_snapshot) in v_digits) > 0 ) ) AS phone_hit,
           ( public.finance_norm_name(s.customer_name_snapshot) IS NOT NULL
             AND length(public.finance_norm_name(s.customer_name_snapshot)) >= 5
             AND ( public.finance_norm_name(s.customer_name_snapshot) = v_name
                   OR position(public.finance_norm_name(s.customer_name_snapshot) in COALESCE(v_name,'')) > 0 ) ) AS name_hit,
           ABS(COALESCE(NULLIF(s.total_amount,0), s.original_gross_amount, 0) - v_inc.amount) AS amt_diff,
           ABS(s.issue_date - v_inc.income_date) AS day_diff
    FROM public.sales_invoices s
    WHERE s.sales_channel::text = 'salla'
      AND s.status::text <> 'cancelled'
      AND s.issue_date BETWEEN (v_inc.income_date - 30) AND (v_inc.income_date + 30)
  ), scored AS (
    SELECT c.*,
      ( CASE WHEN c.phone_hit THEN 60 WHEN c.name_hit THEN 35 ELSE 0 END
      + CASE WHEN c.amt_diff <= 0.05 THEN 25 WHEN c.amt_diff <= 1 THEN 15
             WHEN c.eff_total > 0 AND c.amt_diff / c.eff_total <= 0.05 THEN 8 ELSE 0 END
      + CASE WHEN c.day_diff <= 2 THEN 15 WHEN c.day_diff <= 7 THEN 10
             WHEN c.day_diff <= 30 THEN 5 ELSE 0 END
      + CASE WHEN c.pm = 'تحويل بنكي' THEN 5 ELSE 0 END ) AS sc
    FROM cand c
  )
  SELECT s.id, s.invoice_number, s.issue_date, s.customer_name_snapshot,
         ROUND(s.eff_total,2), ROUND(s.rem,2), s.pm, s.sc,
         CASE WHEN s.sc >= 80 THEN 'عالية' WHEN s.sc >= 50 THEN 'متوسطة' ELSE 'منخفضة' END,
         btrim(concat_ws(' · ',
           CASE WHEN s.phone_hit THEN 'تطابق الجوال' END,
           CASE WHEN s.name_hit THEN 'تطابق الاسم' END,
           CASE WHEN s.amt_diff <= 0.05 THEN 'تطابق المبلغ'
                WHEN s.amt_diff <= 1 THEN 'المبلغ قريب' END,
           CASE WHEN s.day_diff <= 2 THEN 'نفس التاريخ تقريبًا'
                WHEN s.day_diff <= 7 THEN 'خلال أسبوع' END,
           CASE WHEN s.pm = 'تحويل بنكي' THEN 'طريقة الدفع تحويل بنكي' END))
  FROM scored s
  WHERE s.sc > 0
  ORDER BY (CASE WHEN s.phone_hit THEN 1 ELSE 0 END) DESC,
           (CASE WHEN s.name_hit THEN 1 ELSE 0 END) DESC,
           s.amt_diff ASC, s.day_diff ASC, s.sc DESC
  LIMIT 3;
END $fn$;

REVOKE ALL ON FUNCTION public.finance_customer_transfer_suggestions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_customer_transfer_suggestions(uuid) TO authenticated;

-- 6) Safe link action (no new income, no new journal) ------------------------
CREATE OR REPLACE FUNCTION public.finance_link_income_to_invoice(p_income_id uuid, p_invoice_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_inc RECORD; v_inv RECORD; v_rem numeric(14,2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (private.has_role(v_uid,'admin') OR private.has_role(v_uid,'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_inc FROM public.finance_incomes WHERE id = p_income_id FOR UPDATE;
  IF NOT FOUND OR v_inc.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'الحوالة غير موجودة أو مؤرشفة';
  END IF;
  IF v_inc.sales_invoice_id IS NOT NULL AND v_inc.sales_invoice_id <> p_invoice_id THEN
    RAISE EXCEPTION 'الحوالة مرتبطة بفاتورة أخرى — افصل الربط الحالي أولًا';
  END IF;
  IF v_inc.sales_invoice_id = p_invoice_id THEN
    RETURN jsonb_build_object('status','already_linked','invoice_id',p_invoice_id);
  END IF;

  SELECT * INTO v_inv FROM public.sales_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF v_inv.status::text IN ('cancelled','draft') THEN
    RAISE EXCEPTION 'لا يمكن الربط بفاتورة ملغاة أو مسودة — تحتاج مراجعة';
  END IF;

  v_rem := GREATEST(COALESCE(v_inv.total_amount,0) - COALESCE(v_inv.paid_amount,0), 0);
  IF ROUND(v_inc.amount,2) > ROUND(v_rem,2) + 0.05 THEN
    RAISE EXCEPTION 'مبلغ الحوالة (%) أكبر من المتبقي على الفاتورة (%) — تحتاج مراجعة',
      ROUND(v_inc.amount,2), ROUND(v_rem,2);
  END IF;

  UPDATE public.finance_incomes SET
    sales_invoice_id = p_invoice_id,
    customer_id = COALESCE(customer_id, v_inv.customer_id),
    transaction_type = CASE WHEN transaction_type::text IN ('customer_invoice_collection','customer_advance','direct_sale')
                            THEN 'customer_invoice_collection'::public.finance_incoming_type
                            ELSE COALESCE(transaction_type,'customer_invoice_collection'::public.finance_incoming_type) END,
    collection_type = 'invoice_collection'::public.finance_collection_type,
    business_relation = 'business'::public.finance_business_relation,
    accounting_status = 'classified'::public.finance_accounting_status,
    updated_at = now()
  WHERE id = p_income_id;

  INSERT INTO public.finance_audit_logs(related_type, related_id, related_bigint_id, action, field_name,
                                        old_value, new_value, changed_by, note)
  VALUES ('income', p_income_id, p_invoice_id, 'link_sales_invoice', 'sales_invoice_id',
          NULL, p_invoice_id::text, v_uid,
          'ربط حوالة عميل مباشرة بفاتورة ' || COALESCE(v_inv.invoice_number,'#'||p_invoice_id::text));

  RETURN jsonb_build_object('status','linked','invoice_id',p_invoice_id,
                            'invoice_number', v_inv.invoice_number);
END $fn$;

REVOKE ALL ON FUNCTION public.finance_link_income_to_invoice(uuid,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_link_income_to_invoice(uuid,bigint) TO authenticated;

-- 7) Salla preview warning: possible manual duplicate (warning only) ---------
CREATE OR REPLACE FUNCTION public.salla_manual_duplicate_warning(p_row jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_total numeric(14,2) := ROUND(COALESCE((p_row->>'original_gross_amount')::numeric,0),2);
  v_date date;
  v_phone text := public.finance_norm_phone(p_row->>'customer_phone_snapshot');
  v_name  text := public.finance_norm_name(p_row->>'customer_name_snapshot');
  v_hit int := 0;
BEGIN
  IF v_total <= 0 THEN RETURN NULL; END IF;
  BEGIN v_date := NULLIF(btrim(COALESCE(p_row->>'order_date','')),'')::date;
  EXCEPTION WHEN others THEN RETURN NULL; END;
  IF v_date IS NULL THEN RETURN NULL; END IF;
  IF v_phone IS NULL AND (v_name IS NULL OR length(v_name) < 5) THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO v_hit
  FROM public.finance_customer_transfer_status t
  WHERE t.link_state IN ('unlinked','advance_pending','suspected_duplicate')
    AND ABS(t.amount - v_total) <= 0.05
    AND t.income_date BETWEEN (v_date - 7) AND (v_date + 7)
    AND (
      (v_phone IS NOT NULL AND position(v_phone in regexp_replace(COALESCE(t.note,''),'\D','','g')) > 0)
      OR (v_name IS NOT NULL AND length(v_name) >= 5
          AND position(v_name in COALESCE(public.finance_norm_name(t.note),'')) > 0)
    );

  IF v_hit > 0 THEN
    RETURN 'حوالة/فاتورة يدوية محتملة لنفس الطلب — للمراجعة قبل الربط';
  END IF;
  RETURN NULL;
END $fn$;

REVOKE ALL ON FUNCTION public.salla_manual_duplicate_warning(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salla_manual_duplicate_warning(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.salla_import_preview(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $fn$
DECLARE r jsonb; out_arr jsonb := '[]'::jsonb; c jsonb; w text;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
          OR private.has_role(auth.uid(),'finance_manage')
          OR private.has_role(auth.uid(),'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows,'[]'::jsonb)) LOOP
    c := public.salla_classify_row(r);
    w := public.salla_manual_duplicate_warning(r);
    out_arr := out_arr || jsonb_build_array(
      c || jsonb_build_object(
        'rowNo', (r->>'rowNo')::int,
        'external_order_id', r->>'external_order_id',
        'manual_duplicate_warning', w
      )
    );
  END LOOP;
  RETURN out_arr;
END $fn$;