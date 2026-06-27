
-- 1. Seed "دنيا الربيع" into finance_suppliers if missing
INSERT INTO public.finance_suppliers (name, company_name, is_active)
SELECT s.name_ar, s.name_en, s.is_active
FROM public.aqh_suppliers s
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_suppliers f
  WHERE lower(f.name) = lower(s.name_ar)
);

-- 2. Add finance_supplier_id to product_suppliers link table
ALTER TABLE public.aqh_product_suppliers
  ADD COLUMN finance_supplier_id uuid;

-- 3. Backfill (best-effort by name match) — currently 0 rows so noop, but kept for safety
UPDATE public.aqh_product_suppliers ps
SET finance_supplier_id = f.id
FROM public.aqh_suppliers s
JOIN public.finance_suppliers f ON lower(f.name) = lower(s.name_ar)
WHERE ps.supplier_id = s.id;

-- 4. Drop old supplier_id column + recreate constraints
ALTER TABLE public.aqh_product_suppliers DROP COLUMN supplier_id;
ALTER TABLE public.aqh_product_suppliers
  ALTER COLUMN finance_supplier_id SET NOT NULL,
  ADD CONSTRAINT aqh_product_suppliers_finance_supplier_id_fkey
    FOREIGN KEY (finance_supplier_id) REFERENCES public.finance_suppliers(id) ON DELETE CASCADE,
  ADD CONSTRAINT aqh_product_suppliers_unique UNIQUE (product_id, finance_supplier_id);

-- 5. Drop aqh_suppliers table
DROP TABLE public.aqh_suppliers;

-- 6. Update bulk function: p_supplier_id now uuid
DROP FUNCTION IF EXISTS public.aqh_bulk_update_products(bigint[], bigint, text, boolean, numeric, bigint);

CREATE OR REPLACE FUNCTION public.aqh_bulk_update_products(
  p_ids bigint[],
  p_category_id bigint DEFAULT NULL,
  p_restock_type text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_cost_pct numeric DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_category_id IS NOT NULL THEN
    UPDATE public.aqh_products SET category_id = p_category_id WHERE id = ANY(p_ids);
  END IF;
  IF p_restock_type IS NOT NULL THEN
    UPDATE public.aqh_products SET restock_type = p_restock_type WHERE id = ANY(p_ids);
  END IF;
  IF p_is_active IS NOT NULL THEN
    UPDATE public.aqh_products SET is_active = p_is_active WHERE id = ANY(p_ids);
  END IF;
  IF p_cost_pct IS NOT NULL THEN
    UPDATE public.aqh_products
       SET cost = round(cost * (1 + p_cost_pct/100.0), 2)
     WHERE id = ANY(p_ids) AND cost IS NOT NULL;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF p_supplier_id IS NOT NULL THEN
    INSERT INTO public.aqh_product_suppliers (product_id, finance_supplier_id)
    SELECT unnest(p_ids), p_supplier_id
    ON CONFLICT (product_id, finance_supplier_id) DO NOTHING;
  END IF;

  RETURN array_length(p_ids, 1);
END;
$$;
