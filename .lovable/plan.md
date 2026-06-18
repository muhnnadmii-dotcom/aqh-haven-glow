## نطاق العمل

بناء بوابة عميل احترافية في Aqua Haven على ٤ مراحل بالترتيب الذي اخترته. كل مرحلة تُنفّذ وتُختبر قبل الانتقال للتي بعدها.

> **ملاحظة مهمة:** اخترت "إنشاء جداول جديدة بأسماء orders/aquariums". الجداول الحالية (`service_requests`, `customer_tanks`, `request_notes`, `request_reports`, `request_attachments`, `request_status_history`, `appointments`, `maintenance_reports`) تغطي ٩٥٪ من المتطلبات وتستخدمها لوحة الإدارة الحالية + صفحات الطلبات الموجودة. إنشاء جداول جديدة بنفس الغرض سيؤدي إلى:
> - تكرار البيانات أو فقدانها
> - كسر لوحة الإدارة الحالية وصفحات الطلبات الحالية
> - الحاجة لترحيل بيانات (migration) معقد
> - مضاعفة الـ RLS policies والصيانة
>
> **توصيتي القوية:** نُبقي الأسماء الحالية في قاعدة البيانات (آمن، لا يكسر شيء)، ونُسمّي المسارات في الواجهة كما تحب (`/account/orders`, `/account/aquariums`) — تجربة العميل ستكون مطابقة تمامًا لما طلبت، بدون مخاطر. **هل توافق؟** إن أصررت على جداول جديدة، سأحتاج رسالة تأكيد منفصلة وسأنفذ الترحيل بحذر.

أكمل الخطة على افتراض الإجابة الافتراضية (إعادة استخدام الجداول الحالية). إذا غيّرت رأيك أعدّل.

---

## المرحلة 1 — تفاصيل الطلب للعميل + تعليقات + مرفقات

**الملفات:**
- توسيع `src/routes/_authenticated/account.requests.$id.tsx` (موجود) لإضافة: Timeline موحّد، تعليقات عامة، مرفقات ظاهرة للعميل، تقارير الطلب، المواعيد المرتبطة.
- إضافة مكوّن `RequestTimeline` يدمج: `request_status_history` (visible) + `request_notes` (public فقط) + `request_reports` (visible) + `request_attachments` (visible) + `appointments`.
- نموذج تعليق (textarea عربي + رفع مرفق اختياري) → يُدرج في `request_notes` بـ `comment_type='public'`, `is_visible_to_customer=true`.

**قاعدة البيانات (migration واحد):**
- تعديل `request_notes` للتأكد من وجود حقول: `comment_type` (public/internal), `is_visible_to_customer` — وإن لم تكن موجودة نضيفها.
- RLS: العميل يُدرج تعليقات على طلباته فقط، ويقرأ public فقط على طلباته.
- إضافة policy للعميل لرفع `request_attachments` على طلباته (visible=true قسرًا).

**صفحة الإدارة `admin.requests.$id.tsx`:** التأكد من وجود تبويب تعليقات (داخلي + عام)، رفع مرفق visible/internal، إرسال تقرير، تغيير الحالة. (موجود غالبًا — تحقق وأكمل النواقص فقط، بدون إعادة تصميم.)

---

## المرحلة 2 — صفحة `/account/reports`

**ملف جديد:** `src/routes/_authenticated/account.reports.tsx` (+ index)
- يقرأ من `request_reports` JOIN `service_requests` WHERE `user_id = auth.uid()` AND `is_visible_to_customer=true`.
- بطاقات: العنوان، النوع، التاريخ، الطلب/الحوض المرتبط، زر "عرض" يفتح dialog أو يذهب لصفحة الطلب.
- إن لم يكن `is_visible_to_customer` موجودًا على `request_reports`، نضيفه في migration المرحلة 1.

---

## المرحلة 3 — الإشعارات داخل الحساب

**جدول جديد:** `public.notifications`
- الأعمدة: `id, user_id, title, body, type, related_url, is_read, created_at`.
- RLS: العميل يقرأ/يحدّث (is_read فقط) إشعاراته.
- GRANT للـ authenticated و service_role.

**Triggers تلقائية (SECURITY DEFINER):**
- AFTER INSERT على `request_notes` (public + ليس author=customer) → notification "تعليق جديد من Aqua Haven".
- AFTER INSERT على `request_reports` (visible) → "تقرير جديد".
- AFTER UPDATE على `service_requests.status` → "تم تحديث حالة طلبك".
- AFTER INSERT على `appointments` للعميل → "موعد جديد".

**UI:** شارة عدد في الـ Layout (أيقونة جرس بجوار "حسابي") + قائمة منسدلة، أو صفحة `/account/notifications`. ضغط الإشعار يحدّد `is_read=true` ويذهب لـ `related_url`.

---

## المرحلة 4 — Layout محسّن + نظرة عامة `/account`

**تعديل `src/routes/_authenticated/account.tsx`:**
- Drawer (Sheet) من اليمين على الجوال — موجود حاليًا، تحسين بسيط.
- إضافة عنصر "تقاريري" و "الإشعارات" في القائمة.

**تحسين `account.index.tsx`:**
- ترحيب باسم العميل
- 4 كروت ملخص: أحواضي / طلبات مفتوحة / مواعيد قادمة / تقارير جديدة (counts من DB)
- 5 إجراءات سريعة (موجود جزء منها)
- آخر 3 طلبات + آخر 3 أحواض + المواعيد القادمة + آخر التحديثات (موحّد من Timeline)
- Empty states بسيطة

---

## ما لن يُلمس
- الصفحة الرئيسية، صفحات الخدمات العامة، الأعمال، المقالات، الهيدر/الفوتر العام.
- جداول قائمة بأسمائها الحالية.
- لوحة الإدارة (إلا إضافات صغيرة لدعم التعليقات/المرفقات/التقارير).

## الأمان (يُطبّق في كل مرحلة)
- RLS على كل جدول جديد ومحدّث.
- العميل يقرأ/يكتب على بياناته فقط (auth.uid() = user_id) مع JOIN على service_requests للجداول المرتبطة.
- `is_visible_to_customer=false` يُخفي السجل عن العميل في كل من DB و UI.
- ملاحظات داخلية لا تظهر للعميل أبدًا.

## تقرير ما بعد التنفيذ
بعد كل مرحلة سأعطيك تقريرًا: ما أضفت، ما عدّلت، روابط الصفحات، طريقة الاختبار.

---

**هل أبدأ بالمرحلة 1 الآن باستخدام الجداول الحالية؟ أم تصرّ على إنشاء جداول `orders/aquariums` جديدة (وأقبل المخاطر)؟**