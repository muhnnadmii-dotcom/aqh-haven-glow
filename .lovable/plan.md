# نظام تذاكر الطلبات — Aqua Haven

## ملاحظة مهمة قبل البدء

قمت بفحص الكود الحالي:

- مسار صفحة تفاصيل الطلب في الإدارة موجود فعلًا: `/admin/requests/$id` وملفه `src/routes/_authenticated/admin.requests.$id.tsx`.
- زر "عرض" في صفحة الطلبات يستخدم `<Link to="/admin/requests/$id">` بشكل صحيح.
- لذلك زر العرض **يفتح الصفحة**. ما هو ناقص فعلًا: صفحة العميل لتفاصيل الطلب، التعليقات المشتركة، التقارير، المرفقات، وسجل النشاط الكامل.

سأبني كل ذلك. لن أغيّر اسم المسارات إلى `/admin/orders/:id` لأن نظامك مبني على كلمة `requests` ويوجد ربط مع الجداول الحالية (`service_requests`, `request_notes`, `request_status_history`). تغيير الاسم يكسر روابط قديمة بدون فائدة. سأبقي:

- إدارة: `/admin/requests/$id`
- عميل: `/account/requests/$id` (جديدة)

إذا تصرّ على كلمة "orders" أخبرني وسأضيف alias.

---

## المرحلة 1 — قاعدة البيانات (migration واحدة آمنة)

لن أحذف أي جدول. سأضيف فقط:

**1. توسيع `service_requests`:**
- `assigned_to uuid` — الموظف المسؤول
- (الباقي موجود)

**2. توسيع `request_notes`:**
- `visibility text default 'internal'` — `internal` أو `public`
- (تغيير افتراضي للسجلات القديمة: `internal` — العميل لن يرى أي ملاحظة قديمة)

**3. جدول جديد `request_reports`:**
- `id, request_id, title, report_type, body, created_by, is_visible_to_customer, created_at, updated_at`

**4. جدول جديد `request_attachments`:**
- `id, request_id, related_type (request|note|report), related_id, file_path, file_name, file_type, file_size, uploaded_by, is_visible_to_customer, created_at`

**5. توسيع `request_status_history`:**
- `is_visible_to_customer boolean default true` — حتى نتحكم بما يظهر في تايملاين العميل

**RLS:**
- العميل يقرأ طلباته فقط (مطبق حاليًا، سيتم تمديده للجداول الجديدة).
- العميل يقرأ من `request_notes` فقط عندما `visibility = 'public'` ويملك الطلب.
- العميل يكتب تعليق `public` فقط على طلباته.
- العميل يقرأ من `request_reports` و `request_attachments` فقط عندما `is_visible_to_customer = true` ويملك الطلب.
- العميل يرفع مرفقات على طلباته (تُحفظ كـ `is_visible_to_customer = true`).
- staff/admin: قراءة وكتابة كاملة.

**GRANTs** على كل جدول جديد لـ `authenticated` و `service_role`.

---

## المرحلة 2 — صفحة العميل `/account/requests/$id`

ملف جديد: `src/routes/_authenticated/account.requests.$id.tsx`

أقسام (Tabs على الديسكتوب، Accordion على الجوال):
1. **ملخص** — رقم الطلب، النوع، الحالة، التواريخ، تفاصيل الطلب التي أرسلها العميل.
2. **التحديثات (Timeline)** — أحداث `is_visible_to_customer = true` + التعليقات العامة + التقارير + تغييرات الحالة المرئية.
3. **التعليقات** — يضيف العميل تعليقًا (public فقط). يرى ردود الإدارة العامة.
4. **التقارير** — قائمة التقارير المرئية له + معاينة PDF/نص.
5. **المرفقات** — يرى مرفقات `is_visible_to_customer = true`. يستطيع رفع صورة/PDF (حجم ≤ 5MB).
6. **المواعيد** — المواعيد المرتبطة بالطلب الظاهرة له.

العميل **لا يرى**: الملاحظات الداخلية، الموظف المسؤول، أي مرفق داخلي.

تحقق من الملكية في الـ loader — لو الطلب ليس له، يظهر "الطلب غير موجود".

---

## المرحلة 3 — تطوير صفحة الإدارة `/admin/requests/$id`

تعديل الملف الحالي ليصبح بنظام Tabs:

1. **التفاصيل** (موجود — تنظيف فقط)
2. **المحادثة** — تعليقات public (إدارة + عميل) في خيط واحد، إضافة تعليق مع اختيار `public` افتراضيًا.
3. **ملاحظات داخلية** — الـ `internal` فقط، بلون مميز.
4. **التقارير** — قائمة + زر "إنشاء تقرير" (modal: عنوان، نوع، نص طويل، مرفقات، toggle "ظاهر للعميل").
5. **المرفقات** — رفع مع toggle داخلي/عام، عرض كصور/روابط تحميل.
6. **المواعيد** — موجود، إضافة toggle "ظاهر للعميل".
7. **سجل النشاط** — كل الأحداث (status changes, comments, reports, attachments, appointments) مرتبة زمنيًا.

أزرار سريعة في الهيدر (موجودة): واتساب، نسخ الرقم، نسخ الملخص، تغيير الحالة، **+ تعيين مسؤول** (dropdown يقرأ من `user_roles` للأدوار staff/admin).

---

## المرحلة 4 — التخزين

استخدام bucket `media` الموجود. مسار: `request-attachments/{request_id}/{uuid}-{filename}`.

أنواع مسموحة: `image/*, application/pdf`. الحد الأقصى: 5MB.

تحقق على الكلاينت + RLS على `storage.objects` (مكتوبة سابقًا للـ media bucket).

---

## المرحلة 5 — الإصلاحات

- التحقق أن الطلب غير الموجود يظهر "الطلب غير موجود" (موجود حاليًا — سيتم التأكد).
- ربط زر "عرض الطلب" في صفحة `/account/requests` (الحالية) ليفتح التفاصيل الجديدة (حاليًا لا يوجد رابط).
- إضافة badge "تحديث جديد" في صفحة الإدارة لو آخر تعليق من العميل.

---

## ما لن أعمله (خارج النطاق)

- لن أنشئ جداول `orders`, `order_comments`, `order_events`, `order_reports` بأسماء جديدة. سأمدد الجداول الحالية (`service_requests`, `request_notes`, `request_status_history`) وأضيف `request_reports`, `request_attachments`. الأسماء الموحدة (`request_*`) تحافظ على البيانات والكود الحالي.
- لن ألمس صفحة الواجهة الرئيسية، الخدمات، أعمالنا، المقالات.
- لن أضيف إشعارات push/email — فقط badge بصري داخل الإدارة لو وقت سمح.

---

## تنفيذ بالترتيب

1. migration (يحتاج موافقتك في خطوة منفصلة).
2. صفحة العميل `/account/requests/$id` + ربط زر العرض.
3. تطوير صفحة الإدارة بـ tabs + تقارير + مرفقات.
4. اختبار يدوي شامل.

---

**هل أبدأ بالمرحلة 1 (migration)؟** أو تريد تعديل أي شيء في الخطة (مثلًا توحيد الـ tabs، تغيير حد حجم الملفات، إضافة "تعيين مسؤول" بشكل مختلف)؟
