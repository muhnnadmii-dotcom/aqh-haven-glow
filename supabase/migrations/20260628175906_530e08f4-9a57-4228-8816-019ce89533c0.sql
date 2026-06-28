
ALTER TABLE public.home_sections
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS section_type text;

-- Backfill section_type from section_key for existing rows
UPDATE public.home_sections SET section_type = section_key WHERE section_type IS NULL;

-- Seed default sort_order matching current homepage order
UPDATE public.home_sections SET sort_order = 10 WHERE section_key = 'hero';
UPDATE public.home_sections SET sort_order = 20 WHERE section_key = 'explore';
UPDATE public.home_sections SET sort_order = 30 WHERE section_key = 'partners';
UPDATE public.home_sections SET sort_order = 40 WHERE section_key = 'services';
UPDATE public.home_sections SET sort_order = 50 WHERE section_key = 'why_us';
UPDATE public.home_sections SET sort_order = 70 WHERE section_key = 'process';
UPDATE public.home_sections SET sort_order = 90 WHERE section_key = 'testimonials_header';
UPDATE public.home_sections SET sort_order = 91 WHERE section_key = 'homepage_testimonials';
UPDATE public.home_sections SET sort_order = 100 WHERE section_key = 'knowledge_header';
UPDATE public.home_sections SET sort_order = 110 WHERE section_key = 'faq';
UPDATE public.home_sections SET sort_order = 120 WHERE section_key = 'cta';

-- New CMS-managed sections (previously hardcoded)
INSERT INTO public.home_sections (section_key, section_type, enabled, sort_order, content) VALUES
('featured_projects_header', 'section_header', true, 60, jsonb_build_object(
  'kicker', 'أعمالنا',
  'heading', 'مشاريع مختارة',
  'subtitle', 'لقطات من أحواض نفّذناها لعملائنا',
  'link_label', 'كل المشاريع',
  'link_href', '/portfolio'
)),
('maintenance_teaser', 'image_text_split', true, 80, jsonb_build_object(
  'kicker', 'صيانة احترافية',
  'kicker_icon', 'Wrench',
  'heading', 'حوضك بأفضل حال طوال السنة',
  'description', 'باقات صيانة دورية تشمل تنظيف، فحص جودة الماء، فلاتر، إضاءة، وأسماك ونباتات. متابعة مستمرة من فريق متخصص.',
  'image_path', '',
  'image_side', 'left',
  'primary_label', 'احجز صيانة',
  'primary_href', '/maintenance',
  'secondary_label', 'استفسار سريع',
  'secondary_whatsapp', 'أرغب بحجز صيانة لحوضي'
)),
('business_teaser', 'image_text_split', true, 81, jsonb_build_object(
  'kicker', 'حلول الأعمال',
  'kicker_icon', 'Building2',
  'heading', 'أحواض للكافيهات والمكاتب والمطاعم',
  'description', 'نصمم تجربة بصرية فاخرة تعزز هوية مكانك وتجذب عملاءك، مع عقود صيانة كاملة وضمان تشغيلي.',
  'image_path', '',
  'image_side', 'right',
  'primary_label', 'حلول الأعمال',
  'primary_href', '/business-solutions',
  'secondary_label', 'تواصل معنا',
  'secondary_whatsapp', 'استفسار عن حلول الأعمال لأكوا هيفن'
)),
('final_whatsapp_cta', 'whatsapp_cta', true, 130, jsonb_build_object(
  'heading', 'جاهز تبدأ مشروعك المائي؟',
  'description', 'تواصل معنا الآن واحصل على استشارة مجانية وعرض سعر مخصص لمشروعك.',
  'button_label', 'تواصل معنا عبر واتساب',
  'whatsapp_message', ''
))
ON CONFLICT (section_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS home_sections_sort_idx ON public.home_sections (sort_order);
