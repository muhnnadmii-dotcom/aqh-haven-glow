
-- 1) Shipping metadata columns (informational only, nullable)
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS shipping_company text,
  ADD COLUMN IF NOT EXISTS shipment_number text,
  ADD COLUMN IF NOT EXISTS policy_issued_at date,
  ADD COLUMN IF NOT EXISTS tracking_url text;

ALTER TABLE public.salla_orders
  ADD COLUMN IF NOT EXISTS shipping_company text,
  ADD COLUMN IF NOT EXISTS shipment_number text,
  ADD COLUMN IF NOT EXISTS policy_issued_at date,
  ADD COLUMN IF NOT EXISTS tracking_url text;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_shipping_company
  ON public.sales_invoices (shipping_company) WHERE shipping_company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_salla_orders_shipping_company
  ON public.salla_orders (shipping_company) WHERE shipping_company IS NOT NULL;

-- 2) Central normalization of shipping company names
CREATE OR REPLACE FUNCTION public.normalize_shipping_company(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH cleaned AS (
    SELECT NULLIF(btrim(regexp_replace(COALESCE(p_raw,''), '^[\s''"`]+|[\s''"`]+$', '', 'g')), '') AS v
  )
  SELECT CASE
    WHEN v IS NULL THEN NULL
    WHEN v ILIKE '%aramex%' OR v LIKE '%أرامكس%' OR v LIKE '%ارامكس%' THEN 'أرامكس'
    WHEN v ILIKE '%fastlo%' THEN 'Fastlo'
    WHEN v LIKE '%أكواهافن%' OR v LIKE '%اكواهافن%' OR v LIKE '%أكوا هيفن%'
      OR v LIKE '%اكوا هيفن%' OR v LIKE '%أكوا هافن%' OR v LIKE '%اكوا هافن%' THEN 'مندوب أكوا هيفن'
    WHEN v LIKE '%لا يتطلب شحن%' THEN 'لا يتطلب شحن'
    ELSE v
  END
  FROM cleaned;
$$;

REVOKE ALL ON FUNCTION public.normalize_shipping_company(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_shipping_company(text) TO authenticated, service_role;

-- 3) Idempotent shipping-metadata-only writer used by the Salla import chunks.
--    Touches ONLY the four shipping fields; never amounts, status, vat, journals.
CREATE OR REPLACE FUNCTION public.salla_apply_shipping_metadata(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r jsonb;
  v_oid text; v_co text; v_num text; v_date date; v_url text;
  n_orders int := 0; n_invoices int := 0; n_rows int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (private.has_role(v_uid,'admin')
          OR private.has_role(v_uid,'finance_manage')
          OR private.has_role(v_uid,'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows,'[]'::jsonb)) LOOP
    v_oid := NULLIF(btrim(COALESCE(r->>'external_order_id','')), '');
    CONTINUE WHEN v_oid IS NULL;

    v_co  := public.normalize_shipping_company(r->>'shipping_company');
    v_num := NULLIF(btrim(COALESCE(r->>'shipment_number','')), '');
    v_url := NULLIF(btrim(COALESCE(r->>'tracking_url','')), '');
    BEGIN
      v_date := NULLIF(btrim(COALESCE(r->>'policy_issued_at','')), '')::date;
    EXCEPTION WHEN others THEN v_date := NULL;
    END;

    CONTINUE WHEN v_co IS NULL AND v_num IS NULL AND v_url IS NULL AND v_date IS NULL;
    n_rows := n_rows + 1;

    UPDATE public.salla_orders SET
      shipping_company = COALESCE(v_co, shipping_company),
      shipment_number  = COALESCE(v_num, shipment_number),
      policy_issued_at = COALESCE(v_date, policy_issued_at),
      tracking_url     = COALESCE(v_url, tracking_url),
      updated_at = now()
    WHERE external_order_id = v_oid;
    GET DIAGNOSTICS n_orders = ROW_COUNT;

    UPDATE public.sales_invoices SET
      shipping_company = COALESCE(v_co, shipping_company),
      shipment_number  = COALESCE(v_num, shipment_number),
      policy_issued_at = COALESCE(v_date, policy_issued_at),
      tracking_url     = COALESCE(v_url, tracking_url)
    WHERE external_order_id = v_oid;
    GET DIAGNOSTICS n_invoices = ROW_COUNT;
  END LOOP;

  RETURN jsonb_build_object('rows_with_shipping', n_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.salla_apply_shipping_metadata(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salla_apply_shipping_metadata(jsonb) TO authenticated, service_role;
