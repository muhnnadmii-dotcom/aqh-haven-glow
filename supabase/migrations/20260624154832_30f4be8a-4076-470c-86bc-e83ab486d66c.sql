DROP TABLE IF EXISTS public.aqh_restock_requests CASCADE;
DROP TABLE IF EXISTS public.aqh_products CASCADE;

CREATE TABLE public.aqh_products (
  id          bigint generated always as identity primary key,
  sku         text unique not null,
  name_ar     text not null,
  category    text,
  image_url   text,
  current_qty integer not null default 0,
  cost        numeric not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
CREATE INDEX idx_aqh_products_category ON public.aqh_products(category);
CREATE INDEX idx_aqh_products_name     ON public.aqh_products(name_ar);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_products TO authenticated;
GRANT ALL ON public.aqh_products TO service_role;
ALTER TABLE public.aqh_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aqh_products_staff_read" ON public.aqh_products FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "aqh_products_admin_write" ON public.aqh_products FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE public.aqh_restock_requests (
  id            bigint generated always as identity primary key,
  employee_name text,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  status        text not null default 'new' check (status in ('new','ordered','received')),
  items         jsonb not null,
  items_count   integer not null default 0,
  notes         text,
  created_at    timestamptz not null default now()
);
CREATE INDEX idx_aqh_restock_status  ON public.aqh_restock_requests(status);
CREATE INDEX idx_aqh_restock_created ON public.aqh_restock_requests(created_at desc);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_restock_requests TO authenticated;
GRANT ALL ON public.aqh_restock_requests TO service_role;
ALTER TABLE public.aqh_restock_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aqh_restock_staff_all" ON public.aqh_restock_requests FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));