DROP TABLE IF EXISTS public.aqh_restock_requests CASCADE;
DROP TABLE IF EXISTS public.aqh_products CASCADE;

CREATE TABLE public.aqh_products (
  id bigint generated always as identity primary key,
  sku text unique not null,
  name_ar text not null,
  category text,
  image_url text,
  current_qty integer default 0,
  cost numeric default 0,
  restock_type text default 'supplier' check (restock_type in ('supplier','inventory','hidden')),
  is_active boolean default true,
  created_at timestamptz default now()
);
CREATE INDEX idx_aqh_products_category ON public.aqh_products(category);
CREATE INDEX idx_aqh_products_name ON public.aqh_products(name_ar);
CREATE INDEX idx_aqh_products_rtype ON public.aqh_products(restock_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_products TO authenticated;
GRANT ALL ON public.aqh_products TO service_role;
ALTER TABLE public.aqh_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aqh_products_staff_read" ON public.aqh_products FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "aqh_products_admin_write" ON public.aqh_products FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.aqh_restock_requests (
  id bigint generated always as identity primary key,
  employee_name text,
  created_by uuid default auth.uid(),
  request_kind text default 'order' check (request_kind in ('order','report')),
  status text default 'new',
  items jsonb not null,
  items_count integer default 0,
  notes text,
  created_at timestamptz default now()
);
CREATE INDEX idx_aqh_restock_status ON public.aqh_restock_requests(status);
CREATE INDEX idx_aqh_restock_kind ON public.aqh_restock_requests(request_kind);
CREATE INDEX idx_aqh_restock_created ON public.aqh_restock_requests(created_at desc);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_restock_requests TO authenticated;
GRANT ALL ON public.aqh_restock_requests TO service_role;
ALTER TABLE public.aqh_restock_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aqh_restock_staff_all" ON public.aqh_restock_requests FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role));