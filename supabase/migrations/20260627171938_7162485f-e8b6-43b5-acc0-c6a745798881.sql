
-- 1. Dedup aqh_product_categories: keep MIN(id) per name_ar, remap products, delete the rest

-- Build mapping (old_id -> kept_id) in a temp table
CREATE TEMP TABLE _cat_map AS
SELECT c.id AS old_id, k.kept_id
FROM aqh_product_categories c
JOIN (
  SELECT name_ar, MIN(id) AS kept_id
  FROM aqh_product_categories
  GROUP BY name_ar
) k ON k.name_ar = c.name_ar
WHERE c.id <> k.kept_id;

-- Remap products
UPDATE public.aqh_products p
SET category_id = m.kept_id
FROM _cat_map m
WHERE p.category_id = m.old_id;

-- Delete duplicate categories
DELETE FROM public.aqh_product_categories
WHERE id IN (SELECT old_id FROM _cat_map);

-- Clean up slugs on the survivors (give them stable slugs based on name_ar)
UPDATE public.aqh_product_categories
SET slug = 'cat-' || id
WHERE slug ~ '^cat-[0-9]+$';

-- 2. Add vendor_supplier_id to aqh_supplier_products
ALTER TABLE public.aqh_supplier_products
  ADD COLUMN vendor_supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL;

-- Backfill: all current rows belong to Dunya Al-Rabee
UPDATE public.aqh_supplier_products
SET vendor_supplier_id = '57283e96-40ea-4fa7-927d-da2aaf41d5da'::uuid
WHERE vendor_supplier_id IS NULL;

CREATE INDEX IF NOT EXISTS aqh_supplier_products_vendor_idx
  ON public.aqh_supplier_products (vendor_supplier_id);
