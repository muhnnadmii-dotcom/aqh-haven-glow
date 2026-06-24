
CREATE TABLE public.aqh_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  category text,
  unit text DEFAULT 'قطعة',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_products TO authenticated;
GRANT ALL ON public.aqh_products TO service_role;

ALTER TABLE public.aqh_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aqh_products_select_staff" ON public.aqh_products
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));

CREATE POLICY "aqh_products_insert_staff" ON public.aqh_products
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));

CREATE POLICY "aqh_products_update_staff" ON public.aqh_products
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));

CREATE TRIGGER trg_aqh_products_touch
  BEFORE UPDATE ON public.aqh_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


CREATE TABLE public.aqh_restock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.aqh_products(id) ON DELETE RESTRICT,
  qty numeric NOT NULL CHECK (qty > 0),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','ordered','received')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aqh_restock_requests_status ON public.aqh_restock_requests(status);
CREATE INDEX idx_aqh_restock_requests_created_at ON public.aqh_restock_requests(created_at DESC);
CREATE INDEX idx_aqh_restock_requests_product ON public.aqh_restock_requests(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aqh_restock_requests TO authenticated;
GRANT ALL ON public.aqh_restock_requests TO service_role;

ALTER TABLE public.aqh_restock_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aqh_restock_select_staff" ON public.aqh_restock_requests
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));

CREATE POLICY "aqh_restock_insert_staff" ON public.aqh_restock_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role))
    AND requested_by = auth.uid()
  );

CREATE POLICY "aqh_restock_update_staff" ON public.aqh_restock_requests
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));

CREATE TRIGGER trg_aqh_restock_touch
  BEFORE UPDATE ON public.aqh_restock_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.aqh_products (sku, name_ar, name_en, category, unit) VALUES
  ('FOOD-001', 'طعام أسماك حبيبات', 'Pellet fish food', 'أغذية', 'علبة'),
  ('FOOD-002', 'طعام أسماك رقائق', 'Flake fish food', 'أغذية', 'علبة'),
  ('FOOD-003', 'طعام مجمّد', 'Frozen food', 'أغذية', 'علبة'),
  ('CHEM-001', 'مزيل الكلور', 'Water conditioner', 'معالجات', 'زجاجة'),
  ('CHEM-002', 'بكتيريا مفيدة', 'Beneficial bacteria', 'معالجات', 'زجاجة'),
  ('CHEM-003', 'مثبت PH', 'PH stabilizer', 'معالجات', 'زجاجة'),
  ('FILT-001', 'فلتر إسفنجي', 'Sponge filter', 'فلاتر', 'قطعة'),
  ('FILT-002', 'كرات سيراميك', 'Ceramic media', 'فلاتر', 'كيس'),
  ('FILT-003', 'كربون نشط', 'Activated carbon', 'فلاتر', 'كيس'),
  ('EQUIP-001', 'سخان حوض', 'Aquarium heater', 'تجهيزات', 'قطعة'),
  ('EQUIP-002', 'مضخة هواء', 'Air pump', 'تجهيزات', 'قطعة'),
  ('EQUIP-003', 'إضاءة LED', 'LED light', 'تجهيزات', 'قطعة'),
  ('TEST-001', 'كاشف اختبار الماء', 'Water test kit', 'اختبارات', 'علبة'),
  ('CLEAN-001', 'مكشطة طحالب', 'Algae scraper', 'تنظيف', 'قطعة'),
  ('CLEAN-002', 'سيفون تنظيف', 'Gravel siphon', 'تنظيف', 'قطعة');
