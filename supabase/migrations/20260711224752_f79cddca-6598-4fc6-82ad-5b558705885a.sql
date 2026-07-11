
-- 1) Add matching_status + salla_order_id to payment_settlement_lines
ALTER TABLE public.payment_settlement_lines
  ADD COLUMN IF NOT EXISTS matching_status text,
  ADD COLUMN IF NOT EXISTS salla_order_id uuid REFERENCES public.salla_orders(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'psl_matching_status_check'
  ) THEN
    ALTER TABLE public.payment_settlement_lines
      ADD CONSTRAINT psl_matching_status_check
      CHECK (matching_status IS NULL OR matching_status IN (
        'matched_invoice',
        'matched_cancelled_order',
        'cancelled_order_needs_refund_match',
        'order_found_invoice_missing',
        'order_not_found',
        'no_external_order_id'
      ));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_psl_matching_status
  ON public.payment_settlement_lines(matching_status);
CREATE INDEX IF NOT EXISTS idx_psl_salla_order
  ON public.payment_settlement_lines(salla_order_id);

-- 2) Normalization helper
CREATE OR REPLACE FUNCTION public.normalize_order_id(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      translate(coalesce(_v,''),
        '٠١٢٣٤٥٦٧٨٩٫،',
        '0123456789.,'),
      '\.0+$', ''
    ),
    ''
  )
  -- Trim whitespace after translation
$$;

-- Wrap with trim since IMMUTABLE SQL body above doesn't call trim; redefine:
CREATE OR REPLACE FUNCTION public.normalize_order_id(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      btrim(translate(coalesce(_v,''),
        '٠١٢٣٤٥٦٧٨٩٫،',
        '0123456789.,')),
      '\.0+$', ''
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.normalize_order_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_order_id(text) TO authenticated, service_role;

-- 3) Preview function
CREATE OR REPLACE FUNCTION public.rematch_settlement_lines_preview(_settlement_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _res jsonb;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role)
       OR private.has_role(auth.uid(), 'finance_manage'::app_role)) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  WITH lines AS (
    SELECT psl.*, public.normalize_order_id(psl.external_order_id) AS nid
    FROM public.payment_settlement_lines psl
    WHERE _settlement_id IS NULL OR psl.settlement_id = _settlement_id
  ),
  pairs AS (
    SELECT nid,
      sum(CASE WHEN line_type='sale' THEN amount ELSE 0 END) sale_sum,
      sum(CASE WHEN line_type='refund' THEN amount ELSE 0 END) refund_sum
    FROM lines WHERE nid IS NOT NULL
    GROUP BY nid
  ),
  classified AS (
    SELECT l.id, l.line_type, l.nid,
      si.id AS invoice_id, si.invoice_number,
      so.id AS order_id, so.order_status,
      p.sale_sum, p.refund_sum,
      CASE
        WHEN l.nid IS NULL THEN 'no_external_order_id'
        WHEN si.id IS NOT NULL THEN 'matched_invoice'
        WHEN so.id IS NOT NULL AND (
          so.order_status ILIKE '%مسترجع%' OR so.order_status ILIKE '%محذوف%'
          OR so.order_status ILIKE '%cancel%' OR so.order_status ILIKE '%refund%'
        ) THEN CASE
          WHEN p.sale_sum > 0 AND p.refund_sum < 0
               AND abs(p.sale_sum + p.refund_sum) <= 0.02 THEN 'matched_cancelled_order'
          ELSE 'cancelled_order_needs_refund_match'
        END
        WHEN so.id IS NOT NULL AND p.sale_sum > 0 AND p.refund_sum < 0
             AND abs(p.sale_sum + p.refund_sum) <= 0.02 THEN 'matched_cancelled_order'
        WHEN so.id IS NOT NULL THEN 'order_found_invoice_missing'
        ELSE 'order_not_found'
      END AS new_status
    FROM lines l
    LEFT JOIN public.sales_invoices si
      ON si.sales_channel = 'salla'
     AND public.normalize_order_id(si.external_order_id) = l.nid
    LEFT JOIN public.salla_orders so
      ON public.normalize_order_id(so.external_order_id) = l.nid
    LEFT JOIN pairs p ON p.nid = l.nid
  )
  SELECT jsonb_build_object(
    'total_lines', (SELECT count(*) FROM lines),
    'with_external_order', (SELECT count(*) FROM lines WHERE nid IS NOT NULL),
    'by_status', (SELECT jsonb_object_agg(new_status, cnt)
                  FROM (SELECT new_status, count(*) cnt FROM classified GROUP BY new_status) x),
    'sample_order_not_found', (
      SELECT jsonb_agg(DISTINCT nid) FROM (
        SELECT nid FROM classified WHERE new_status='order_not_found' AND nid IS NOT NULL LIMIT 20
      ) s
    )
  ) INTO _res;
  RETURN _res;
END$$;

REVOKE ALL ON FUNCTION public.rematch_settlement_lines_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rematch_settlement_lines_preview(uuid) TO authenticated;

-- 4) Apply function
CREATE OR REPLACE FUNCTION public.rematch_settlement_lines_apply(_settlement_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _res jsonb;
  _updated int;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role)
       OR private.has_role(auth.uid(), 'finance_manage'::app_role)) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  WITH lines AS (
    SELECT psl.id, psl.line_type, psl.amount, psl.settlement_id,
           public.normalize_order_id(psl.external_order_id) AS nid
    FROM public.payment_settlement_lines psl
    WHERE _settlement_id IS NULL OR psl.settlement_id = _settlement_id
  ),
  pairs AS (
    SELECT nid,
      sum(CASE WHEN line_type='sale' THEN amount ELSE 0 END) sale_sum,
      sum(CASE WHEN line_type='refund' THEN amount ELSE 0 END) refund_sum
    FROM lines WHERE nid IS NOT NULL
    GROUP BY nid
  ),
  classified AS (
    SELECT l.id,
      si.id AS invoice_id,
      so.id AS order_id,
      CASE
        WHEN l.nid IS NULL THEN 'no_external_order_id'
        WHEN si.id IS NOT NULL THEN 'matched_invoice'
        WHEN so.id IS NOT NULL AND (
          so.order_status ILIKE '%مسترجع%' OR so.order_status ILIKE '%محذوف%'
          OR so.order_status ILIKE '%cancel%' OR so.order_status ILIKE '%refund%'
        ) THEN CASE
          WHEN p.sale_sum > 0 AND p.refund_sum < 0
               AND abs(p.sale_sum + p.refund_sum) <= 0.02 THEN 'matched_cancelled_order'
          ELSE 'cancelled_order_needs_refund_match'
        END
        WHEN so.id IS NOT NULL AND p.sale_sum > 0 AND p.refund_sum < 0
             AND abs(p.sale_sum + p.refund_sum) <= 0.02 THEN 'matched_cancelled_order'
        WHEN so.id IS NOT NULL THEN 'order_found_invoice_missing'
        ELSE 'order_not_found'
      END AS new_status
    FROM lines l
    LEFT JOIN public.sales_invoices si
      ON si.sales_channel = 'salla'
     AND public.normalize_order_id(si.external_order_id) = l.nid
    LEFT JOIN public.salla_orders so
      ON public.normalize_order_id(so.external_order_id) = l.nid
    LEFT JOIN pairs p ON p.nid = l.nid
  ),
  upd AS (
    UPDATE public.payment_settlement_lines psl
    SET sales_invoice_id = c.invoice_id,
        salla_order_id   = c.order_id,
        matching_status  = c.new_status
    FROM classified c
    WHERE psl.id = c.id
      AND (psl.sales_invoice_id IS DISTINCT FROM c.invoice_id
        OR psl.salla_order_id  IS DISTINCT FROM c.order_id
        OR psl.matching_status IS DISTINCT FROM c.new_status)
    RETURNING psl.id, c.new_status
  )
  SELECT jsonb_build_object(
    'updated', (SELECT count(*) FROM upd),
    'by_status', (SELECT jsonb_object_agg(new_status, cnt)
                  FROM (SELECT new_status, count(*) cnt FROM classified GROUP BY new_status) x)
  ) INTO _res;

  BEGIN
    INSERT INTO public.finance_audit_logs(actor_id, action, entity_type, entity_id, changes)
    VALUES (auth.uid(), 'rematch_settlement_lines',
            'payment_settlement', _settlement_id, _res);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN _res;
END$$;

REVOKE ALL ON FUNCTION public.rematch_settlement_lines_apply(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rematch_settlement_lines_apply(uuid) TO authenticated;
