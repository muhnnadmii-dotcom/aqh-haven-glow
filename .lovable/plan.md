## المرحلة الثانية — المقالات، من نحن، التواصل

تنفّذ هذه المرحلة فقط. ما تم في المراحل السابقة يبقى كما هو.

### 1) المقالات

**قاعدة البيانات** — توسيع جدول `articles` الموجود (لا جدول جديد):
- `category text` (تصنيف اختياري)
- `seo_title text`
- `seo_description text`
- `featured_on_home boolean default false`
- `home_order int default 0`
- `visible boolean default true` (إخفاء بدون حذف، مستقل عن `published`)

يبقى: `slug, title, excerpt, body, cover_path, cover_image, tags, published, published_at`.

**لوحة الإدارة** — تحديث `admin.articles.tsx`:
- قائمة بالمقالات (Loading / Empty / Error).
- بطاقات فيها: عنوان، slug، حالة النشر، إظهار/إخفاء، مميز للرئيسية، أزرار تعديل/حذف.
- نموذج تعديل يحتوي على كل الحقول:
  - عنوان، slug، التصنيف، الوسوم، حالة النشر، حالة الإظهار.
  - مقتطف، محتوى (textarea كبيرة تدعم Markdown بسيط — أسطر فارغة = فقرات، ##/### = عناوين).
  - صورة الغلاف عبر `ImageUploader` (تستخدم bucket `media`).
  - SEO title و SEO description.
  - "مميز في الرئيسية" + رقم الترتيب.

**الواجهة العامة**:
- `src/routes/knowledge.index.tsx`: قراءة من DB بدل المصفوفة الثابتة. فلترة `published=true AND visible=true`. حالات Loading/Empty/Error.
- `src/routes/knowledge.$slug.tsx`: جلب المقال من DB حسب الـ slug، عرض المحتوى بمعالج Markdown بسيط (فقرات + عناوين)، استخدام `seo_title/seo_description` في `head()` مع التراجع للعنوان/المقتطف.
- `src/routes/index.tsx` (قسم المقالات): قراءة المقالات التي `featured_on_home=true AND published AND visible` مرتبة بـ `home_order` (حد 3). بدون hardcoded.

### 2) صفحة "من نحن"

**قاعدة البيانات** — استخدام جدول `site_pages` الموجود مع `page_key='about'`. `content jsonb` بالشكل التالي:
```json
{
  "hero": { "kicker": "ABOUT", "heading": "من نحن", "description": "...", "image_path": "" },
  "story": { "kicker": "قصتنا", "heading": "...", "body": "..." },
  "vision": { "kicker": "رؤيتنا", "heading": "...", "body": "..." },
  "values_heading": "ما يحركنا",
  "values_kicker": "قيمنا",
  "values": [
    { "id":"v1","icon":"Award","title":"الإتقان","desc":"...","order":1,"visible":true }
  ],
  "stats": [
    { "id":"s1","value":"9+","label":"سنوات خبرة","order":1,"visible":true }
  ],
  "cta": { "kicker":"...", "heading":"...", "body":"...", "button_label":"...", "button_href":"/contact", "visible":true }
}
```

**لوحة الإدارة** — صفحة جديدة `admin.design.about.tsx` (تبويب جديد ضمن `/admin/design` بعنوان "من نحن"):
- حقول مهيكلة لكل قسم (لا JSON خام للمستخدم).
- صور عبر `ImageUploader`.
- إضافة/تعديل/حذف/إخفاء/ترتيب لعناصر القيم والإحصائيات.

**الواجهة العامة** — تحديث `src/routes/about.tsx` لقراءة `site_pages` (`page_key='about'`) وعرضه. بذور تساوي المحتوى الحالي. Loading/Empty/Error.

### 3) صفحة "تواصل معنا"

**قاعدة البيانات** — `site_pages` مع `page_key='contact'`:
```json
{
  "hero": { "kicker":"CONTACT","heading":"تواصل معنا","description":"..." },
  "city": "الرياض، المملكة العربية السعودية",
  "phone": "+966 52 704 4200",
  "whatsapp_number": "966527044200",
  "email": "",
  "working_hours": "السبت - الخميس 9ص - 9م",
  "socials": [
    { "id":"so1","platform":"instagram","label":"Instagram","href":"https://...","visible":true },
    { "id":"so2","platform":"tiktok","label":"TikTok","href":"https://...","visible":true }
  ],
  "whatsapp_card": {
    "title":"دردشة واتساب فورية",
    "subtitle":"رد سريع خلال ساعات العمل",
    "button_label":"دردشة واتساب",
    "visible": true
  },
  "form": {
    "submit_label":"إرسال عبر واتساب",
    "success_message":"تم استلام طلبك، سنتواصل معك قريباً",
    "intro":"ابدأ محادثتك معنا..."
  },
  "request_types": ["استفسار","طلب مشروع","دعم فني","شراكة تجارية"]
}
```

**لوحة الإدارة** — `admin.design.contact.tsx` (تبويب "تواصل معنا" ضمن `/admin/design`):
- حقول واضحة: رقم الواتساب، الهاتف، البريد، المدينة، ساعات العمل.
- قائمة سوشال (إضافة/تعديل/حذف/إخفاء): platform select (instagram/tiktok/twitter/snapchat/youtube/facebook/linkedin)، label، href.
- نصوص الكرت الترويجي للواتساب وأزرار النموذج وأنواع الطلبات.

**الواجهة العامة** — تحديث `src/routes/contact.tsx`:
- قراءة `site_pages` (key=contact). كل الحقول من DB.
- رقم الواتساب من DB → `wa.me/...` (قابل للضغط).
- روابط السوشال من DB (تظهر فقط ما هو `visible`).
- إذا حقل غير موجود/فارغ → تُخفى البطاقة المعنية بدون كسر التصميم.
- مكوّن `WhatsAppFloating` يبقى يستخدم رقم افتراضي ثابت من `WhatsAppButton.tsx` (المرحلة هذه تخص الصفحة فقط؛ ربط الزر العائم لاحقاً عند الحاجة).

### 4) الأدمن — تنقّل
داخل قسم "تصميم المتجر" نضيف تبويبات/روابط:
- الصفحة الرئيسية (موجود)
- **من نحن** (جديد)
- **التواصل** (جديد)

والقسم القديم `/admin/articles` يظل في "محتوى الصفحات" بنفس مكانه، مع التحسينات المذكورة.

### 5) متطلبات تقنية
- RLS: الموجود سليم — `articles` يدير الأدمن فقط، قراءة عامة للمنشور؛ `site_pages` للأدمن فقط، قراءة عامة. لا حاجة لتعديل.
- Storage: bucket `media` الموجود + `ImageUploader`.
- RTL وموبايل: محافظة كاملة، نفس نمط `admin.design.tsx`.
- Loading: skeleton/spinner. Empty: نص واضح. Error: toast + رسالة.
- حماية: كل المسارات تحت `/admin` يحرسها gate الأدمن الموجود.

### 6) الملفات
**Migration واحد** يضيف الأعمدة على `articles` ويُدخل بذور `site_pages` لـ `about` و `contact` (idempotent).

**جديد:**
- `src/routes/_authenticated/admin.design.about.tsx`
- `src/routes/_authenticated/admin.design.contact.tsx`

**تعديل:**
- `src/routes/_authenticated/admin.articles.tsx` (حقول كاملة + ImageUploader)
- `src/routes/_authenticated/admin.design.tsx` (تبويبات: hero/explore/services/about/contact)
- `src/routes/about.tsx` (قراءة من DB)
- `src/routes/contact.tsx` (قراءة من DB)
- `src/routes/knowledge.index.tsx` (قراءة من DB)
- `src/routes/knowledge.$slug.tsx` (قراءة من DB)
- `src/routes/index.tsx` (مقالات الرئيسية من DB)

### خارج النطاق
- ربط الواتساب العائم بـ DB.
- محرر WYSIWYG متقدّم (نكتفي بـ markdown مبسط الآن).
- بقية الصفحات (services، maintenance، portfolio…).
