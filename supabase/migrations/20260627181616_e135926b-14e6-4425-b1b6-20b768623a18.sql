
-- 1) Unified products view for quote builder
CREATE OR REPLACE VIEW public.aqh_quote_products AS
  SELECT
    'salla'::text   AS source,
    p.sku           AS ref,
    p.name_ar       AS name,
    p.category      AS category,
    NULL::text      AS supplier_name,
    p.cost          AS cost,
    NULL::numeric   AS supplier_cost
  FROM public.aqh_products p
  WHERE p.is_active = true
UNION ALL
  SELECT
    'supplier'::text AS source,
    sp.item_no       AS ref,
    sp.name          AS name,
    sp.supplier_name AS category,
    sp.supplier_name AS supplier_name,
    NULL::numeric    AS cost,
    sp.cost          AS supplier_cost
  FROM public.aqh_supplier_products sp
  WHERE sp.is_active = true;

GRANT SELECT ON public.aqh_quote_products TO authenticated;

-- 2) Quotes table
CREATE TABLE IF NOT EXISTS public.aqh_quotes (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quote_no      text UNIQUE,
  client_name   text,
  client_contact text,
  project_name  text,
  project_city  text,
  status        text DEFAULT 'draft',
  currency      text DEFAULT 'SAR',
  vat_rate      numeric DEFAULT 15,
  discount      numeric DEFAULT 0,
  discount_type text DEFAULT 'amount',
  prices_include_vat boolean DEFAULT true,
  items         jsonb NOT NULL DEFAULT '[]',
  scope_text    text,
  notes_text    text,
  payment_terms text,
  delivery_terms text,
  warranty_terms text,
  subtotal      numeric DEFAULT 0,
  vat_total     numeric DEFAULT 0,
  grand_total   numeric DEFAULT 0,
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_quotes TO authenticated;
GRANT ALL ON public.aqh_quotes TO service_role;

CREATE INDEX IF NOT EXISTS idx_aqh_quotes_status ON public.aqh_quotes(status);
CREATE INDEX IF NOT EXISTS idx_aqh_quotes_created ON public.aqh_quotes(created_at DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_aqh_quotes_touch ON public.aqh_quotes;
CREATE TRIGGER trg_aqh_quotes_touch BEFORE UPDATE ON public.aqh_quotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-generate quote number (AQH-YYYY-NNN)
CREATE OR REPLACE FUNCTION public.aqh_next_quote_no()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'AQH-' || to_char(now(),'YYYY') || '-' ||
    lpad((COALESCE(MAX(
      NULLIF(regexp_replace(quote_no, '^AQH-\d{4}-', ''), '')::int
    ),0)+1)::text, 3, '0')
  FROM public.aqh_quotes
  WHERE quote_no LIKE 'AQH-' || to_char(now(),'YYYY') || '-%';
$$;

-- RLS — admin or staff full access
ALTER TABLE public.aqh_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aqh_quotes_all" ON public.aqh_quotes;
CREATE POLICY "aqh_quotes_all" ON public.aqh_quotes
  FOR ALL
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'));
