
# تطوير صفحة أعمالنا — قسمان داخل نفس الصفحة

## الهدف
إضافة قسم جديد "لقطات من أعمالنا" داخل صفحة أعمالنا، **بدون أي مساس بنظام المشاريع الحالي**. النظام الحالي يبقى كما هو تمامًا.

---

## 1) قاعدة البيانات

### جدول جديد: `work_gallery_items`
لا أعدّل `projects` ولا `project_categories`. جدول مستقل خفيف:

- `id` uuid PK
- `title` text (اختياري)
- `image_url` text (الصورة الرئيسية، إجبارية)
- `extra_images` text[] (صور إضافية اختيارية)
- `tank_type` text — نهري/بحري/نباتي/نانو/أكواسكب/قبل-بعد
- `size_category` text — small/medium/large
- `style` text — natural/luxury/minimal/rocky/planted/marine/modern
- `care_level` text — easy/medium/advanced
- `suitable_for` text[] — home/office/majlis/cafe/restaurant/reception
- `linked_project_id` uuid REFERENCES projects(id) ON DELETE SET NULL
- `is_published` bool default true
- `is_featured` bool default false
- `display_order` int default 0
- `created_at`, `updated_at`

### الصلاحيات و RLS
- `GRANT SELECT TO anon, authenticated` (محتوى عام مثل projects)
- `GRANT ALL TO authenticated` للأدمن عبر سياسة `has_role(admin)`
- سياسة قراءة عامة: `is_published = true`
- سياسة كتابة: admin فقط

---

## 2) صفحة أعمالنا للعميل

ملف: `src/routes/portfolio.tsx` (أو الصفحة الحالية للأعمال) — أضيف تبويبات:

- **تبويب 1: مشاريع منفذة** → يعرض المحتوى الحالي كما هو (نفس الكروت، نفس الفلاتر، نفس الفتح)
- **تبويب 2: لقطات من أعمالنا** → الجديد

### قسم اللقطات
- شبكة مربعة (Pinterest/Instagram-style): `aspect-square`, `object-cover`
- 2 أعمدة موبايل / 3 تابلت / 4 ديسكتوب
- فلاتر علوية: نوع الحوض، الحجم، الستايل، مستوى العناية، مناسب لـ
  - ديسكتوب: شريط فلاتر أفقي
  - موبايل: زر "فلترة" يفتح Drawer/Sheet
- الضغط على لقطة → Dialog بصورة كبيرة + الوسوم + زرّان:
  - "أبغى مثل هذا" → ينقل إلى `/services/custom-aquariums?ref_gallery=<id>&ref_title=...&tank_type=...`
  - "عرض المشروع الكامل" → فقط إذا `linked_project_id` موجود
- بدون نجوم/تقييم. وسوم فقط.

### تمرير المرجع لفورم الطلب المخصص
في صفحة `custom-aquariums` أقرأ `searchParams` وأملأ حقل "التصميم المرجعي" تلقائيًا.

---

## 3) لوحة الإدارة

ملف جديد: `src/routes/_authenticated/admin.gallery.index.tsx`
- جدول باللقطات: صورة مصغّرة، العنوان، النوع، منشور، ترتيب
- زر "إضافة لقطة" → Dialog/Sheet:
  - رفع صورة رئيسية (ImageUploader للـ bucket `media`)
  - صور إضافية اختيارية
  - عنوان قصير
  - selects للنوع/الحجم/الستايل/العناية
  - multi-select لـ "مناسب لـ"
  - select لربط بمشروع موجود (اختياري) — يجلب من `projects`
  - نشر/إخفاء، ترتيب
- تعديل/حذف لكل سطر

أضيف رابط "لقطات الأعمال" في `admin.tsx` بجوار "المشاريع" بدون لمس المشاريع.

---

## 4) الملفات الجديدة/المعدّلة

**جديد:**
- migration: `work_gallery_items` + RLS + grants
- `src/lib/work-gallery.ts` — types + helpers (labels عربية للفلاتر)
- `src/routes/_authenticated/admin.gallery.index.tsx`
- `src/components/portfolio/GalleryTab.tsx`
- `src/components/portfolio/GalleryFilters.tsx`
- `src/components/portfolio/GalleryLightbox.tsx`

**معدّل (إضافة فقط، بدون كسر):**
- صفحة الأعمال الحالية: لف المحتوى الحالي في Tabs وأضف التبويب الثاني
- `src/routes/_authenticated/admin.tsx`: عنصر تنقّل جديد
- `src/routes/services.custom-aquariums.tsx` (أو المسار الفعلي): قراءة `ref_*` من search params وتعبئة الفورم
- `src/integrations/supabase/types.ts`: يتحدّث تلقائيًا بعد المايجريشن

---

## 5) ضمانات عدم الكسر
- صفر تعديل على جدول `projects` أو على مكوّنات/صفحات المشاريع الحالية
- اللقطة المرتبطة بمشروع = سجل مستقل يخزّن `linked_project_id` فقط؛ حذف مشروع → السجل يبقى مع `linked_project_id = NULL`
- لا تكرار للصور: اللقطة تخزن `image_url` خاص بها (قد يكون نفس رابط صورة من مشروع، لكن السجل مستقل)

---

## 6) خطة الاختبار
1. المشاريع القديمة تظهر في تبويب "مشاريع منفذة" بنفس الشكل
2. فتح تفاصيل مشروع يعمل كما كان
3. إضافة لقطة جديدة من الأدمن (مع/بدون ربط مشروع)
4. الفلاتر في "لقطات من أعمالنا" تعمل
5. زر "أبغى مثل هذا" يفتح فورم الطلب المخصص مع مرجع معبّأ
6. زر "عرض المشروع الكامل" يظهر فقط للمرتبطة
7. شبكة الصور مربعة على الجوال والديسكتوب
8. RLS: زائر يرى المنشور فقط، الأدمن يدير الكل

---

## ملاحظات للتأكيد
- **اسم صفحة الأعمال الحالية**: سأكتشفه أوتوماتيكيًا من `src/routes/` (غالبًا `portfolio.tsx` أو `our-work.tsx`)
- **bucket التخزين**: سأستخدم `media` الموجود
- **فورم الطلب المخصص**: سأمرر البيانات عبر search params لتجنّب أي تعديل في منطق الفورم نفسه
