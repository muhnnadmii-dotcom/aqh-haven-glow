
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS featured_on_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

INSERT INTO public.site_pages (page_key, title, content) VALUES
('about', 'من نحن', '{
  "hero": {
    "kicker": "ABOUT",
    "heading": "من نحن",
    "description": "أكوا هيفن (AQH) شركة سعودية متخصصة في تصميم وتنفيذ الأحواض المائية الفاخرة. انطلقنا من الرياض برؤية واضحة: أن نقدم تجربة مائية لا مثيل لها — تجمع بين الفن الهندسي والاحترافية في الرعاية.",
    "image_path": ""
  },
  "story": {
    "kicker": "قصتنا",
    "heading": "رحلة من الشغف إلى الاحتراف",
    "body": "بدأت أكوا هيفن من شغف عميق بعالم الأسماك والأحواض. ومع مرور السنين، تطورنا من هواة إلى مرجع موثوق في المملكة، نخدم عشاق هذا العالم — من المنازل الراقية حتى أكبر المطاعم والفنادق."
  },
  "vision": {
    "kicker": "رؤيتنا",
    "heading": "العلامة الرائدة في السعودية",
    "body": "أن نكون العلامة الأولى المرجعية في عالم الأحواض المائية بالمملكة، وأن نقدم تجارب استثنائية تتحدث عن نفسها. نؤمن بأن كل حوض يجب أن يكون تحفة فنية تنبض بالحياة."
  },
  "values_kicker": "قيمنا",
  "values_heading": "ما يحركنا",
  "values": [
    {"id":"v1","icon":"Award","title":"الإتقان","desc":"نسعى للكمال في كل تفصيلة من أحواضنا.","order":1,"visible":true},
    {"id":"v2","icon":"Heart","title":"الشغف","desc":"نحب ما نعمل، وهذا يظهر في كل مشروع.","order":2,"visible":true},
    {"id":"v3","icon":"Sparkles","title":"الفخامة","desc":"نقدم تجربة فاخرة من الاستشارة حتى التسليم.","order":3,"visible":true},
    {"id":"v4","icon":"Eye","title":"الرؤية","desc":"نرى الجمال في الطبيعة ونعيد تشكيله.","order":4,"visible":true}
  ],
  "stats": [],
  "cta": {
    "kicker": "رؤية مستقبلية",
    "heading": "مركز تجربة أكوا هيفن في الرياض",
    "body": "نعمل على افتتاح أول مركز تجربة ومعرض دائم في الرياض — مساحة تجمع بين أرقى الأحواض والمنتجات والاستشارات المباشرة من فريقنا. قريباً، عش التجربة الكاملة.",
    "button_label": "كن أول من يعلم",
    "button_href": "/contact",
    "visible": true
  }
}'::jsonb),
('contact', 'تواصل معنا', '{
  "hero": {
    "kicker": "CONTACT",
    "heading": "تواصل معنا",
    "description": "ابدأ محادثتك معنا. سيتم إرسال طلبك مباشرة عبر واتساب لفريقنا."
  },
  "city": "الرياض، المملكة العربية السعودية",
  "phone": "+966 52 704 4200",
  "whatsapp_number": "966527044200",
  "email": "",
  "working_hours": "",
  "socials": [
    {"id":"so1","platform":"instagram","label":"Instagram","href":"https://instagram.com","visible":true},
    {"id":"so2","platform":"tiktok","label":"TikTok","href":"https://tiktok.com","visible":true}
  ],
  "whatsapp_card": {
    "title": "دردشة واتساب فورية",
    "subtitle": "رد سريع خلال ساعات العمل",
    "button_label": "دردشة واتساب",
    "visible": true
  },
  "form": {
    "submit_label": "إرسال عبر واتساب",
    "success_message": "تم استلام طلبك، سنتواصل معك قريباً",
    "intro": "ابدأ محادثتك معنا. سيتم إرسال طلبك مباشرة عبر واتساب لفريقنا."
  },
  "request_types": ["استفسار","طلب مشروع","دعم فني","شراكة تجارية"]
}'::jsonb)
ON CONFLICT (page_key) DO NOTHING;
