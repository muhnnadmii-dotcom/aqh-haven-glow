
ALTER TABLE public.aqh_products ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE public.aqh_products ADD COLUMN IF NOT EXISTS salla_raw jsonb;

DROP VIEW IF EXISTS public.aqh_quote_products;
CREATE VIEW public.aqh_quote_products AS
SELECT 'salla'::text AS source,
       p.sku AS ref,
       p.name_ar AS name,
       p.category,
       NULL::text AS supplier_name,
       p.cost,
       p.price,
       NULL::numeric AS supplier_cost,
       p.image_url
  FROM public.aqh_products p
 WHERE p.is_active = true
UNION ALL
SELECT 'supplier'::text AS source,
       sp.item_no AS ref,
       sp.name,
       sp.supplier_name AS category,
       sp.supplier_name,
       NULL::numeric AS cost,
       NULL::numeric AS price,
       sp.cost AS supplier_cost,
       NULL::text AS image_url
  FROM public.aqh_supplier_products sp
 WHERE sp.is_active = true;

GRANT SELECT ON public.aqh_quote_products TO authenticated;
GRANT SELECT ON public.aqh_quote_products TO anon;
