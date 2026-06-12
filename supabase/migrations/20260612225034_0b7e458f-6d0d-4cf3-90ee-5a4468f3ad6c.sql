
CREATE TABLE IF NOT EXISTS public.home_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_sections TO authenticated;
GRANT ALL ON public.home_sections TO service_role;

ALTER TABLE public.home_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_sections public read"
  ON public.home_sections FOR SELECT
  USING (true);

CREATE POLICY "home_sections admin insert"
  ON public.home_sections FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "home_sections admin update"
  ON public.home_sections FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "home_sections admin delete"
  ON public.home_sections FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER home_sections_touch
  BEFORE UPDATE ON public.home_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed defaults (idempotent)
INSERT INTO public.home_sections (section_key, enabled, content) VALUES
('hero', true, '{
  "title": "عالمك المائي",
  "subtitle": "يبدأ من هنا",
  "description": "نصمم ونبني أنظمة بيئية مائية فاخرة — أحواض مخصصة، تركيبات تجارية، وعناية متواصلة بأعلى المعايير العالمية.",
  "primary_cta_label": "تسوق الآن",
  "primary_cta_href": "https://aqh.sa",
  "secondary_cta_label": "اطلب مشروعك",
  "secondary_cta_href": "/contact",
  "image_path": "",
  "overlay_enabled": true,
  "overlay_opacity": 0.6
}'::jsonb),
('explore', true, '{
  "kicker": "EXPLORE",
  "heading": "استكشف أكوا هيفن",
  "subtitle": "انتقل مباشرة لما يهمك من خلال المكعبات أدناه.",
  "items": [
    {"id":"e1","icon":"Briefcase","emoji":null,"label":"أعمالنا","desc":"مشاريع مختارة","href":"/portfolio","order":1,"visible":true},
    {"id":"e2","icon":"Sparkles","emoji":null,"label":"خدماتنا","desc":"حلول متكاملة","href":"/services","order":2,"visible":true},
    {"id":"e3","icon":"Wrench","emoji":null,"label":"الصيانة","desc":"باقات شهرية","href":"/maintenance","order":3,"visible":true},
    {"id":"e4","icon":"MessagesSquare","emoji":null,"label":"استشارات","desc":"خبرة موثوقة","href":"/consultation","order":4,"visible":true},
    {"id":"e5","icon":"BookOpen","emoji":null,"label":"مركز المعرفة","desc":"مقالات ودلائل","href":"/knowledge","order":5,"visible":true},
    {"id":"e6","icon":"Users","emoji":null,"label":"من نحن","desc":"قصتنا ورؤيتنا","href":"/about","order":6,"visible":true},
    {"id":"e7","icon":"Phone","emoji":null,"label":"تواصل معنا","desc":"نحن قريبون","href":"/contact","order":7,"visible":true}
  ]
}'::jsonb),
('services', true, '{
  "kicker": "SERVICES",
  "heading": "ماذا نقدم",
  "description": "حلول متكاملة لكل من يطمح لعالم مائي استثنائي.",
  "items": [
    {"id":"s1","icon":"Fish","title":"أحواض مخصصة","desc":"تصميم وتنفيذ أحواض مائية تحاكي رؤيتك بدقة هندسية وجمالية.","image_path":"","href":"/portfolio","order":1,"visible":true},
    {"id":"s2","icon":"Building2","title":"أنظمة تجارية","desc":"حلول للمطاعم والكافيهات والفعاليات وأنظمة المأكولات البحرية الحية.","image_path":"","href":"/portfolio","order":2,"visible":true},
    {"id":"s3","icon":"Wrench","title":"صيانة دورية","desc":"باقات شهرية مرنة تضمن استدامة جمال أحواضك وصحة سكانها.","image_path":"","href":"/maintenance","order":3,"visible":true},
    {"id":"s4","icon":"MessagesSquare","title":"استشارات","desc":"أرسل تفاصيل حوضك واحصل على توصية متخصصة من فريقنا.","image_path":"","href":"/consultation","order":4,"visible":true}
  ]
}'::jsonb)
ON CONFLICT (section_key) DO NOTHING;
