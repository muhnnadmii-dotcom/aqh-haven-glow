## المشكلة

محرر `/admin/content` يحفظ في `site_pages` لكن لا تظهر التعديلات على الموقع — لأن صفحة `maintenance` فقط هي المربوطة فعلياً عبر `usePageDoc + PageRenderer`. بقية الصفحات (`services`, `consultation`, `business-solutions`, `trust`, `catalog`, `portfolio`, `knowledge`, `services/custom-aquariums`) لها محتوى ثابت داخل ملفاتها ولا تقرأ من CMS. كذلك القائمة في لوحة الإدارة غير منظمة: تخلط بين صفحات لها محررات مخصصة (الرئيسية، من نحن، تواصل، الخدمات، المعرض…) وصفحات CMS فارغة الافتراضيات.

## الحل — مرحلتان

### المرحلة 1: ربط الصفحات بالمحرر فعلياً

نعتمد نمطين بدل نمط واحد:

**أ) صفحات CMS كاملة** (تُعرض بالكامل عبر `PageRenderer`):
- `/maintenance` (موجود)
- `/consultation` — نضيف Hero + Checklist قابلة للتعديل فوق نموذج الإرسال (النموذج يبقى كود)
- `/trust` — تتحول كلياً لـ `rich_text` sections
- `/business-solutions` — Hero + CTA قابلة للتعديل، ومكوّن `BusinessSolutions` يبقى كما هو

**ب) صفحات هجينة** (Hero/Intro/CTA من CMS + بيانات حية من قاعدة البيانات):
- `/services` — Hero قابل للتعديل + قسم CTA نهائي قابل للتعديل (قائمة الخدمات تبقى من جدول `services`)
- `/services/custom-aquariums` — Hero + CTA
- `/catalog`, `/portfolio`, `/knowledge` — إضافة Hero قابل للتعديل في أعلى كل صفحة

**التنفيذ التقني**:
1. توسيع `registry.ts` — تعبئة `defaults` لكل صفحة بمحتوى يطابق ما يظهر حالياً (Hero مع العنوان والوصف الحالي + CTA).
2. تعديل ملفات الصفحات لاستدعاء `usePageDoc(key)` ورندر الأقسام المعرّفة من CMS، مع إبقاء الأجزاء الديناميكية (نماذج، قوائم من DB، Gallery).
3. إضافة helper `<CmsSection doc={doc} id="hero" fallback={...} />` لتسهيل دمج قسم واحد داخل صفحة هجينة.
4. لو `enabled=false` للقسم، يُخفى تلقائياً.

### المرحلة 2: إعادة تنظيم لوحة "محتوى الموقع"

تُصبح `/admin/content` لوحة مركزية واحدة تجمع كل ما يخص محتوى الموقع، مقسّمة لمجموعات واضحة:

```text
محتوى الموقع
├── الصفحات الرئيسية (محررات مخصصة)
│   ├── الصفحة الرئيسية          → /admin/design
│   ├── من نحن                    → /admin/design/about
│   └── تواصل معنا                → /admin/design/contact
│
├── صفحات قابلة للتحرير الكامل (CMS)
│   ├── باقات الصيانة             → /admin/content/maintenance
│   ├── الاستشارات                → /admin/content/consultation
│   ├── الخصوصية والثقة           → /admin/content/trust
│   └── حلول الأعمال              → /admin/content/business_solutions
│
├── صفحات هجينة (Hero + CTA فقط)
│   ├── صفحة الخدمات              → /admin/content/services_index
│   ├── تصميم أحواض مخصصة         → /admin/content/service_custom
│   ├── المتجر                    → /admin/content/catalog_meta
│   ├── أعمالنا                   → /admin/content/portfolio_meta
│   └── المعرفة                   → /admin/content/knowledge_meta
│
└── المحتوى الديناميكي (CRUD مستقل)
    ├── الخدمات                   → /admin/services
    ├── المشاريع                  → /admin/projects
    ├── معرض الأعمال              → /admin/gallery
    ├── المقالات                  → /admin/articles
    └── التقييمات                 → /admin/testimonials
```

كل كرت يعرض: عنوان، وصف قصير لما يمكن تعديله، زر "تعديل" + زر "معاينة الصفحة".

في الشريط الجانبي للأدمن نُبقي رابط واحد فقط: **"محتوى الموقع"** يقود إلى هذه اللوحة المركزية، ونحذف التكرار.

## ملفات ستُعدَّل/تُنشأ

**جديد**:
- `src/lib/cms/CmsSection.tsx` — رندر قسم واحد بمعرّف

**معدّل**:
- `src/lib/cms/registry.ts` — تعبئة defaults لكل الصفحات
- `src/routes/consultation.tsx`, `trust.tsx`, `business-solutions.tsx` — استهلاك CMS
- `src/routes/services.index.tsx`, `services.custom-aquariums.tsx`, `catalog.tsx`, `portfolio.tsx`, `knowledge.index.tsx` — Hero/CTA هجين
- `src/routes/_authenticated/admin.content.index.tsx` — التصميم الجديد بالمجموعات
- `src/routes/_authenticated/admin.tsx` + `src/lib/admin-pages.ts` — تنظيف الروابط المكررة

## ترتيب التنفيذ

1. توسيع `registry.ts` بالافتراضيات + إنشاء `CmsSection.tsx`
2. ربط الصفحات الأربع الكاملة (consultation, trust, business-solutions, maintenance موجودة)
3. ربط الصفحات الخمس الهجينة
4. إعادة بناء لوحة `admin.content.index` بالمجموعات وتنظيف الشريط الجانبي

النتيجة: أي تعديل في `/admin/content/<page>` يظهر فوراً على الصفحة العامة، واللوحة مرتّبة وواضحة.