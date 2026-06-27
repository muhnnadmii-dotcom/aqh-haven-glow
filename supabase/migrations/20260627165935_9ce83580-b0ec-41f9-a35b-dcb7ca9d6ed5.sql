
-- ============================================================
-- AQH · Integrated Inventory Management
-- New tables: suppliers, categories, product-supplier links
-- ============================================================

-- 1) SUPPLIERS
CREATE TABLE IF NOT EXISTS public.aqh_suppliers (
  id bigint generated always as identity primary key,
  key text not null unique,
  name_ar text not null,
  name_en text,
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_suppliers TO authenticated;
GRANT ALL ON public.aqh_suppliers TO service_role;

ALTER TABLE public.aqh_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aqh_suppliers_staff_read" ON public.aqh_suppliers
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "aqh_suppliers_staff_write" ON public.aqh_suppliers
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER aqh_suppliers_touch BEFORE UPDATE ON public.aqh_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) CATEGORIES
CREATE TABLE IF NOT EXISTS public.aqh_product_categories (
  id bigint generated always as identity primary key,
  name_ar text not null,
  slug text not null unique,
  parent_id bigint references public.aqh_product_categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_product_categories TO authenticated;
GRANT ALL ON public.aqh_product_categories TO service_role;

ALTER TABLE public.aqh_product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aqh_cats_staff_read" ON public.aqh_product_categories
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "aqh_cats_staff_write" ON public.aqh_product_categories
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER aqh_cats_touch BEFORE UPDATE ON public.aqh_product_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) PRODUCT ↔ SUPPLIER (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.aqh_product_suppliers (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.aqh_products(id) on delete cascade,
  supplier_id bigint not null references public.aqh_suppliers(id) on delete cascade,
  supplier_sku text,
  cost numeric(10,2),
  lead_time_days integer,
  is_preferred boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_aqh_ps_product ON public.aqh_product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_aqh_ps_supplier ON public.aqh_product_suppliers(supplier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_product_suppliers TO authenticated;
GRANT ALL ON public.aqh_product_suppliers TO service_role;

ALTER TABLE public.aqh_product_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aqh_ps_staff_read" ON public.aqh_product_suppliers
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "aqh_ps_staff_write" ON public.aqh_product_suppliers
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER aqh_ps_touch BEFORE UPDATE ON public.aqh_product_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Add category_id column to aqh_products (optional FK, keep legacy text column)
ALTER TABLE public.aqh_products
  ADD COLUMN IF NOT EXISTS category_id bigint references public.aqh_product_categories(id) on delete set null;

CREATE INDEX IF NOT EXISTS idx_aqh_products_category ON public.aqh_products(category_id);

-- 5) Seed default supplier
INSERT INTO public.aqh_suppliers (key, name_ar, name_en, is_active)
VALUES ('dunya_rabee', 'دنيا الربيع', 'Dunya Al-Rabee', true)
ON CONFLICT (key) DO NOTHING;

-- 6) Migrate existing text categories into the categories table
INSERT INTO public.aqh_product_categories (name_ar, slug, sort_order)
SELECT DISTINCT
  category,
  'cat-' || row_number() over (order by category),
  10
FROM public.aqh_products
WHERE category IS NOT NULL AND category <> ''
ON CONFLICT (slug) DO NOTHING;

-- Link aqh_products.category_id to the matching category by name
UPDATE public.aqh_products p
SET category_id = c.id
FROM public.aqh_product_categories c
WHERE p.category IS NOT NULL
  AND p.category = c.name_ar
  AND p.category_id IS NULL;

-- 7) Bulk update RPC for products
CREATE OR REPLACE FUNCTION public.aqh_bulk_update_products(
  p_ids bigint[],
  p_category_id bigint DEFAULT NULL,
  p_restock_type text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_cost_pct numeric DEFAULT NULL,
  p_supplier_id bigint DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
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
    INSERT INTO public.aqh_product_suppliers (product_id, supplier_id)
    SELECT unnest(p_ids), p_supplier_id
    ON CONFLICT (product_id, supplier_id) DO NOTHING;
  END IF;

  RETURN array_length(p_ids, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.aqh_bulk_update_products(bigint[], bigint, text, boolean, numeric, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.aqh_bulk_update_products(bigint[], bigint, text, boolean, numeric, bigint) TO authenticated;
