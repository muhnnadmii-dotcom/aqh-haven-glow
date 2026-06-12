## المرحلة الأولى — تعديل البار + قسم "تصميم المتجر" في لوحة الإدارة

### 1) شريط التنقل
- حذف رابط **"استشارات"** من `src/components/Navbar.tsx` (نسخة الديسكتوب + الجوال).
- باقي الروابط تبقى كما هي بنفس الترتيب.

### 2) قاعدة البيانات (Supabase)
إنشاء **جدول واحد** `home_sections` لتخزين أقسام الصفحة الرئيسية القابلة للتعديل، عبر migration:

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | uuid PK | |
| `section_key` | text UNIQUE | `hero` / `explore` / `services` |
| `enabled` | boolean | إظهار/إخفاء القسم كاملاً |
| `content` | jsonb | كل البيانات القابلة للتعديل (مفصّل أدناه) |
| `updated_at` | timestamptz | |

**RLS:**
- SELECT للجميع (`anon` + `authenticated`) — محتوى عام.
- INSERT/UPDATE/DELETE فقط لـ `has_role(auth.uid(),'admin')`.
- GRANT مناسب + trigger `touch_updated_at`.

**صور:** ترفع إلى bucket `media` الموجود، ويخزن المسار النصي في `content` ويُعرض عبر `publicUrl()` (موجود في `src/lib/storage.ts`).

#### شكل `content` لكل قسم

**hero:**
```json
{
  "title": "عالمك المائي",
  "subtitle": "يبدأ من هنا",
  "description": "...",
  "primary_cta_label": "تسوق الآن",
  "primary_cta_href": "https://aqh.sa",
  "secondary_cta_label": "اطلب مشروعك",
  "secondary_cta_href": "/contact",
  "image_path": "uid/uploads/xxx.jpg",
  "overlay_enabled": true,
  "overlay_opacity": 0.6
}
```

**explore:** (المربعات)
```json
{
  "heading": "استكشف أكوا هيفن",
  "kicker": "EXPLORE",
  "subtitle": "...",
  "items": [
    { "id": "uuid", "icon": "Briefcase", "emoji": null, "label": "أعمالنا", "desc": "...", "href": "/portfolio", "order": 1, "visible": true }
  ]
}
```
الأيقونة: اختيار من قائمة `lucide-react` المعروفة، أو إيموجي نصي بديل.

**services:** (ماذا نقدم)
```json
{
  "heading": "ماذا نقدم",
  "kicker": "SERVICES",
  "description": "...",
  "image_path": null,
  "items": [
    { "id": "uuid", "icon": "Fish", "title": "أحواض مخصصة", "desc": "...", "image_path": "...", "href": "/portfolio", "order": 1, "visible": true }
  ]
}
```

### 3) لوحة الإدارة — قسم "تصميم المتجر"
- إضافة مجموعة جديدة في الشريط الجانبي لـ `src/routes/_authenticated/admin.tsx` باسم **"تصميم المتجر"** تحتوي:
  - `/admin/design/home` (نظرة عامة + روابط لكل قسم).
  - `/admin/design/home/hero`
  - `/admin/design/home/explore`
  - `/admin/design/home/services`

**الملفات الجديدة:**
- `src/routes/_authenticated/admin.design.home.tsx` (Outlet + Index)
- `src/routes/_authenticated/admin.design.home.hero.tsx`
- `src/routes/_authenticated/admin.design.home.explore.tsx`
- `src/routes/_authenticated/admin.design.home.services.tsx`

كل صفحة تحتوي حقول كاملة (نصوص + روابط + رفع صور باستخدام `ImageUploader`/`MultiImageUploader`)، مع للأقسام list-based (explore/services): إضافة/تعديل/حذف/إخفاء/ترتيب (سحب أو حقل رقم).

### 4) ربط الصفحة الرئيسية
تعديل `src/routes/index.tsx`:
- إضافة `loader` يستدعي `ensureQueryData` لجلب `home_sections` (الثلاثة) عبر استعلام Supabase مباشر (قراءة عامة، لا تحتاج server fn).
- المكوّن يستخدم `useSuspenseQuery`.
- بدلاً من الثوابت `navCubes` و `services` ونصوص الـHero: تُقرأ من البيانات.
- البذور (seed) في الـmigration: إدراج صف افتراضي لكل من `hero`/`explore`/`services` بالقيم الحالية الظاهرة في الموقع، حتى لا يفقد المستخدم أي محتوى.
- إذا `enabled = false` ⇒ يُخفى القسم بالكامل.
- في حال غياب صورة الـhero ⇒ صورة افتراضية موجودة `aqh-living-room-tank`.
- معالجة Loading (Suspense fallback)، Empty، Error (errorComponent للراوت).

### 5) ما خارج النطاق (لاحقاً)
- بقية أقسام الصفحة الرئيسية (Why us / Process / Stats / Partners / Testimonials / Articles / FAQ).
- صفحات أخرى (services route, about, ...).
- تغييرات تصميم.

### ملاحظات للمراجعة بعد التنفيذ
- سيتم إنشاء جدول `home_sections` فقط (مرن لإضافة أقسام لاحقاً بنفس النمط).
- البيانات الموجودة لن تُحذف؛ تُنقل كبذور.
- رفع الصور يستخدم bucket `media` الحالي + سياسات RLS الحالية.
