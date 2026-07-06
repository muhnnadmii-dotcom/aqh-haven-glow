## الهدف
إضافة دعم كامل للغة الإنجليزية (AR/EN) مع محول لغة في Navbar، دعم URLs بالشكل `/en/...`، تحويل تلقائي بين RTL و LTR، ولوحة إدارة لتحرير الترجمات مع ترجمة تلقائية عبر Lovable AI (Gemini) وتحديث تلقائي للنصوص الجديدة.

---

## 1) البنية التحتية للغة (i18n)

- `src/lib/i18n/LangProvider.tsx` — React Context يوفّر `lang` (`ar` | `en`)، `setLang(l)`، `dir` (`rtl`/`ltr`)، `t(key)`.
  - المصدر: `localStorage("aqh_lang")` + `URLSearchParams("lang")` + بادئة المسار `/en`.
  - عند التغيير: تحديث `document.documentElement.lang` و `dir`، حفظ التفضيل، ودفع Query invalidation لإعادة جلب محتوى CMS باللغة الجديدة.
- `src/lib/i18n/strings.ts` — قاموس ثابت `{ ar: {...}, en: {...} }` لجميع النصوص الثابتة في:
  - `Navbar`, `Footer`, `WhatsAppButton`, أزرار مشتركة، رسائل النماذج، labels الحسابات.
- `useT()` hook قصير لاستخدامه في المكونات.
- تفعيل `dir="rtl|ltr"` في `__root.tsx` عبر state من الـ Provider، مع تبديل خط المحتوى الإنجليزي إلى Inter (يبقى IBM Plex Sans Arabic للعربي).

## 2) محول اللغة

- زر AR/EN في `Navbar` (desktop + mobile) يبدّل فورًا ويحدّث `localStorage` + الـ URL.
- دعم مسار `/en/...` عبر Layout route `src/routes/_lang.tsx` بديل — **بدلاً منه لتفادي مضاعفة كل الـ routes**، نستخدم:
  - `?lang=en` كـ URL قابل للمشاركة (يعمل مع كل صفحة تلقائيًا).
  - Middleware في `LangProvider` يقرأ `/en/*` إن وُجد ويحوّله داخليًا.
  - إضافة `<link rel="alternate" hreflang="ar/en">` في `__root.tsx` لتحسين SEO.

## 3) قاعدة البيانات (Migration)

إضافة عمود `content_en jsonb` للجداول التي تحتوي محتوى:

```sql
ALTER TABLE public.site_pages ADD COLUMN content_en jsonb;
ALTER TABLE public.site_pages ADD COLUMN title_en text;
ALTER TABLE public.projects   ADD COLUMN title_en text, ADD COLUMN description_en text, ADD COLUMN summary_en text;
ALTER TABLE public.articles   ADD COLUMN title_en text, ADD COLUMN excerpt_en text, ADD COLUMN body_en text;
ALTER TABLE public.services   ADD COLUMN title_en text, ADD COLUMN description_en text;
```

- جدول جديد `ui_translations (key text pk, ar text, en text, updated_at timestamptz)` لتخزين ترجمات الواجهة الثابتة القابلة للتحرير من اللوحة (يطغى على القاموس الثابت عند وجوده).
- `GRANT SELECT` للجميع + `GRANT ALL` للـ admin/staff عبر RLS.

## 4) قراءة المحتوى ثنائي اللغة

- تعديل `fetchPageDoc(page_key)` و `fetchSitePage()` لقبول `lang` واختيار `content_en` عند `en` مع fallback للعربي.
- تعديل `PageRenderer` / `CmsSlot` لتمرير `lang` من الـ Provider.
- تعديل قوائم المشاريع/المقالات/الخدمات لاختيار الحقل المناسب.

## 5) لوحة إدارة الترجمات

مسار جديد: `/admin/translations` تحت `_authenticated`، بثلاث تبويبات:

1. **واجهة الموقع (UI)** — جدول من `ui_translations` + مفاتيح القاموس الثابت. حقل AR (للقراءة) + حقل EN قابل للتحرير + زر "ترجمة تلقائية" لكل صف.
2. **صفحات CMS** — قائمة `site_pages`، فتح صفحة يعرض الأقسام جنبًا إلى جنب (AR read-only | EN editable)، مع زر "ترجمة كل الصفحة تلقائيًا".
3. **المحتوى الديناميكي** — تبويبات فرعية للمشاريع / المقالات / الخدمات، جدول موحّد فيه العنوان AR و EN والأزرار.

**أدوات مشتركة:**
- زر "🔄 اكتشاف نصوص جديدة" يمسح كل الجداول ويظهر الصفوف التي تنقصها ترجمة EN.
- زر "🌐 ترجمة كل الناقص تلقائيًا" (batch).
- Toast عند النجاح/الفشل.

## 6) الترجمة التلقائية (Lovable AI Gateway)

Server function جديدة `src/lib/i18n/translate.functions.ts`:

```ts
translateAr2En({ texts: string[] }) → { translations: string[] }
```

- تستخدم `google/gemini-3-flash-preview` عبر `@ai-sdk/openai-compatible`.
- Prompt: "ترجم من العربية إلى الإنجليزية الاحترافية مع الحفاظ على النبرة الفاخرة لعلامة Aqua Haven. أرجع JSON فقط."
- محمية بـ `requireSupabaseAuth` + فحص دور admin/staff.
- تدعم batch حتى 50 نصًا في المرة الواحدة.

## 7) الاكتشاف التلقائي للنصوص الجديدة

- عند حفظ صفحة CMS (`savePageDoc`)، إذا كان الحقل `content_en` فارغًا أو أقدم من `content` (نضيف `content_updated_at`)، تظهر شارة "بحاجة ترجمة" في لوحة الترجمات.
- نفس المنطق للجداول الأخرى عبر مقارنة `updated_at` مع `translated_at`.

## 8) SEO

- `<html lang>` و `dir` ديناميكيان.
- `<link rel="alternate" hreflang="ar" href="..."> / hreflang="en"` في كل route.
- تحديث `head()` في الصفحات ليختار العنوان/الوصف حسب اللغة.

---

## ما لن يتغيّر
- شكل الموقع الحالي وألوانه والخطوط العربية.
- سلوك RTL يبقى الافتراضي عند الدخول.
- لوحة الإدارة نفسها تبقى عربية (لا نترجم واجهة /admin).

## الملفات الرئيسية المتأثرة
- جديد: `src/lib/i18n/*`, `src/routes/_authenticated/admin.translations.tsx`, migration واحد.
- تعديل: `__root.tsx`, `Navbar.tsx`, `Footer.tsx`, `PageRenderer.tsx`, `cms/api.ts`, `site-pages.ts`.

## التقديرات
عمل كبير نسبيًا (migration + ~15 ملف). سأنفّذه على مرحلة واحدة كاملة بعد موافقتك.
