## الهدف
نظام تحكم كامل (CMS) للأدمن يغطّي **كل الصفحات العامة** في الموقع — مع إظهار/إخفاء كل قسم، تعديل كل النصوص والصور، بالإضافة إلى **تحرير مباشر داخل الصفحة (Inline Edit)** للأدمن فقط.

النظام يجمع بين:
- **لوحة موحّدة** في `/admin/content` فيها تبويب لكل صفحة عامة.
- **زر "تعديل هذا القسم" يطفو فوق كل قسم** عند تصفّح الموقع كأدمن، يفتح محرّر سريع لنفس المحتوى.

---

## التغطية (كل الصفحات العامة)

| # | الصفحة | الوضع الحالي | الإجراء |
|---|--------|--------------|---------|
| 1 | `/` الرئيسية | متحكَّم فيها جزئياً عبر `home_sections` | تكامل كامل + إخفاء/إظهار |
| 2 | `/about` من نحن | `site_pages` موجودة | يبقى + Inline editor |
| 3 | `/contact` تواصل | `site_pages` موجودة | يبقى + Inline editor |
| 4 | `/services` و `/services/index` | ثابتة في الكود | نقل المحتوى إلى `site_pages` |
| 5 | `/services/$slug` | يقرأ من جدول `services` | تحكّم كامل من `/admin/services` (موجود — نحسّنه) |
| 6 | `/services/custom-aquariums` | ثابتة | نقل إلى `site_pages` |
| 7 | `/maintenance` | ثابتة | نقل إلى `site_pages` |
| 8 | `/consultation` | ثابتة | نقل إلى `site_pages` |
| 9 | `/business-solutions` | ثابتة | نقل إلى `site_pages` |
| 10 | `/catalog` | يقرأ من قاعدة البيانات | إضافة هيرو/نصوص قابلة للتعديل |
| 11 | `/portfolio` | يقرأ من `projects` | إضافة هيرو + هيدر قابل للتعديل |
| 12 | `/knowledge` + `/knowledge/$slug` | يقرأ من `articles` | إضافة هيرو قابل للتعديل |
| 13 | `/trust` | ثابتة | نقل إلى `site_pages` |
| 14 | Navbar + Footer | ثابتة | تعديل روابط/عبارات/سوشيال |

---

## بنية النظام

### 1. قاعدة البيانات
كل المحتوى الديناميكي يُخزَّن في `site_pages` (موجود) أو `home_sections` (موجود) بصيغة JSON منظَّم. لا نضيف جداول جديدة — فقط نوسّع المفاتيح:

`site_pages.page_key` الجديدة:
`services_index`, `service_custom`, `maintenance`, `consultation`, `business_solutions`, `catalog_meta`, `portfolio_meta`, `knowledge_meta`, `trust`, `navbar`, `footer`.

كل سجل = `{ sections: [{ id, type, enabled, content }] }` حيث `type` يحدّد شكل المحرّر (hero, text_block, feature_grid, faq, cta, image_gallery، إلخ).

### 2. مكتبة مكوّنات قابلة للتعديل (`src/lib/cms/`)
- `useEditableSection(page_key, section_id)` — يجلب البيانات + يكشف إن كان المستخدم أدمن.
- `<EditableSection>` — wrapper يضيف زر "تعديل" يطفو فوق القسم عند تمرير الماوس (للأدمن فقط).
- `<EditableText>`, `<EditableImage>`, `<EditableList>` — مكوّنات تحرير سريع inline.
- `<SectionVisibilityGate>` — يخفي القسم إذا `enabled=false` (ويظهره للأدمن بطبقة "مخفي").

### 3. لوحة الأدمن الموحّدة `/admin/content`
- شريط جانبي: قائمة كل الصفحات.
- لكل صفحة: قائمة أقسامها مع toggle إظهار/إخفاء، سحب لإعادة الترتيب، وزر تعديل يفتح نموذج حسب `type`.
- محرّرات الأقسام: نصوص (مع Rich text بسيط)، صور (ImageUploader موجود)، قوائم (إضافة/حذف/ترتيب).
- زر "معاينة" يفتح الصفحة العامة في تبويب جديد بـ `?preview=1` لإظهار المخفيات.

### 4. التحرير المباشر (Inline)
في `__root.tsx`: إذا المستخدم أدمن، يُحقن `<AdminEditOverlay>` يُحيط بكل `<EditableSection>` بحدّ متقطّع + زر "تعديل". الضغط يفتح Dialog بنفس نموذج لوحة الأدمن.

### 5. الصلاحيات
يبقى المسار محميًّا بنفس صلاحية `admin.design` الحالية. نضيف `/admin/content` لـ `ADMIN_PAGES` في `src/lib/admin-pages.ts` ضمن مجموعة "محتوى الموقع".

---

## خطة التنفيذ على مراحل

### المرحلة 1 — الأساس (Foundation)
1. إنشاء `src/lib/cms/types.ts` — تعريفات Section types.
2. إنشاء `src/lib/cms/hooks.ts` — `useEditableSection`, `useIsAdmin`, `useSitePage`.
3. إنشاء `src/lib/cms/components/` — `EditableSection`, `EditableText`, `EditableImage`, `SectionVisibilityGate`, `AdminEditOverlay`, `SectionEditorDialog`.
4. تركيب `AdminEditOverlay` في `__root.tsx`.

### المرحلة 2 — لوحة الأدمن الموحّدة
1. إنشاء `/admin/content/index.tsx` (قائمة الصفحات).
2. إنشاء `/admin/content/$page_key.tsx` (محرّر صفحة كاملة: أقسام + ترتيب + إظهار/إخفاء + معاينة).
3. إضافة الرابط لـ `admin-pages.ts` و Sidebar.

### المرحلة 3 — هجرة الصفحات الثابتة إلى CMS
لكل صفحة من (services, services/index, custom-aquariums, maintenance, consultation, business-solutions, trust):
- إنشاء صفّ ابتدائي في `site_pages` بمحتواها الحالي (seed).
- تعديل ملف المسار ليقرأ من CMS عبر `useSitePage` + يلفّ أقسامه بـ `EditableSection`.

### المرحلة 4 — صفحات البيانات الديناميكية
- `/catalog`, `/portfolio`, `/knowledge`: إضافة هيرو + هيدر قابل للتعديل (لا نمسّ القوائم لأنها من جداول حيّة).
- تحسين `/admin/services` الحالي لإضافة toggle إظهار/إخفاء للخدمة في القائمة.

### المرحلة 5 — Navbar + Footer + Polish
1. نقل روابط/نصوص الـ Navbar والـ Footer إلى `site_pages`.
2. وضع "Preview Mode" toggle في شريط الأدمن لرؤية الموقع كزائر.
3. توحيد رسائل النجاح/الخطأ وحالات التحميل.

---

## الملفات الرئيسية المتأثّرة
- **جديد**: `src/lib/cms/*`, `src/routes/_authenticated/admin.content.index.tsx`, `src/routes/_authenticated/admin.content.$page.tsx`, migrations لإضافة seed لكل `page_key`.
- **معدَّل**: كل ملفات `src/routes/` العامة (لفّ الأقسام)، `__root.tsx`, `admin-pages.ts`, الـ Sidebar، `Navbar.tsx`, `Footer.tsx`.

## ملاحظات تقنية
- لا تغيير على Auth أو RLS — `site_pages` فيها سياسة قراءة عامة وكتابة للأدمن أصلاً.
- الصور: نستخدم `ImageUploader` الموجود (Supabase Storage).
- لا نلمس بيانات العملاء أو الطلبات.
- SSR-safe: الـ `EditableSection` overlay يُحمَّل client-only.

---

## أولوية البدء (نظرًا لاتساع النطاق)
أقترح البدء بـ **المرحلة 1 + المرحلة 2 + هجرة 3 صفحات** (services index, maintenance, consultation) كدفعة أولى قابلة للتسليم. ثم نكمل بقية الصفحات في دفعات لاحقة بناءً على رأيك. وافِق على هذا الترتيب أو اختر صفحات معيّنة تبدأ بها أولًا.