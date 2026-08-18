
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
      OR v LIKE '%ئتمان%' OR v LIKE '%إئتمان%' THEN 'البطاقة الائتمانية'
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
