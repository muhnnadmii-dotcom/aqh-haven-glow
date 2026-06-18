# نظام إسناد الطلبات للموظفين (Staff Assignment)

نظام مستقل تمامًا عن حالة الطلب الحالية. حالة الطلب `status` تبقى كما هي ولا تُمس.

## 1. قاعدة البيانات

### إضافة دور `staff` إن لم يكن موجودًا
- التحقق من `app_role` enum وإضافة `'staff'` إن لزم.

### تعديل `profiles`
- إضافة `display_name_for_customer text` — الاسم اللطيف الظاهر للعميل.

### تعديل `service_requests` (الطلبات)
حقول جديدة، كلها اختيارية، لا تمس `status`:
- `assigned_to_staff_id uuid` (FK → auth.users)
- `assigned_by uuid`
- `assigned_at timestamptz`
- `assignment_status` enum جديد: `unassigned | assigned | accepted | transferred` (افتراضي `unassigned`)
- `accepted_by_staff_at timestamptz`
- `assignment_department text` (تصميم/صيانة/استشارة/مبيعات/دعم)
- `assignment_note text`

### جدول جديد `request_assignment_events`
سجل أحداث الإسناد المستقل عن `request_status_history`:
- `id, request_id, event_type, from_staff_id, to_staff_id, actor_id, note, department, visible_to_customer bool, created_at`
- أنواع: `assigned | accepted | transferred | unassigned`

### تحديث RLS
- `service_requests`: السماح لـ `staff` بقراءة الطلبات المسندة له فقط، و`admin` بقراءة الكل.
- `staff` يستطيع UPDATE على حقول الإسناد فقط لطلباته (للضغط على "استلام").
- `admin` يستطيع الإسناد/التحويل لأي طلب.

### Triggers
- `notify_on_assignment`: عند تغيّر `assignment_status` إلى `assigned` أو `accepted` → إشعار للعميل (نصوص لطيفة) + إشعار للموظف.
- إدراج تلقائي في `request_assignment_events` عند تغيّر `assigned_to_staff_id` أو `assignment_status`.

## 2. لوحة الإدارة

### `admin.requests.index.tsx`
- إضافة عمود "المسؤول" + شارة حالة الإسناد + القسم.
- فلاتر جديدة: غير مسندة / مسندة / تم استلامها / طلباتي / حسب الموظف / حسب القسم.
- شارة "غير مسند" بارزة (أحمر) للطلبات بدون موظف.

### `admin.index.tsx` (Dashboard)
- كرت "طلبات غير مسندة"
- كرت "مسندة لم تُستلم"
- كرت "طلباتي" (للموظف الحالي)

### `admin.requests.$id.tsx`
قسم جديد "إسناد الطلب" يعرض كل بيانات الإسناد + أزرار:
- إسناد / تغيير الموظف / إزالة الإسناد / تحويل
- نموذج Dialog لاختيار الموظف من قائمة `staff` + قسم + ملاحظة
- زر "استلام الطلب" يظهر للموظف المسؤول فقط

### Timeline الإدارة
دمج `request_assignment_events` مع timeline الموجود (status_history + notes + reports).

## 3. صفحة الموظف
- `account.tsx`: إذا الدور `staff`، إضافة عنصر تنقل "طلباتي (Staff)" → `/admin/requests?mine=1`.
- صفحات الإدارة يصل لها `staff` لكن RLS يحصرها على المسند إليه.

## 4. صفحة العميل `account.requests.$id.tsx`
قسم جديد "متابعة الطلب" بنصوص مهذبة بحسب `assignment_status`:
- `unassigned`: "تم استلام طلبك، ولم يتم تعيين مسؤول المتابعة بعد..."
- `assigned`: "تم تعيين مسؤول لمتابعة طلبك..."
- `accepted`: "[display_name_for_customer] من فريق Aqua Haven يتابع طلبك" — أو "فريق Aqua Haven يتابع طلبك" إذا لا يوجد اسم لطيف.

**لا يُعرض للعميل**: رقم/إيميل/role الموظف. فقط `display_name_for_customer`.

## 5. الصلاحيات (RLS باختصار)
- admin: كل شيء
- staff: قراءة/تحديث الإسناد لطلباته فقط
- customer: قراءة طلباته فقط بدون أي بيانات موظف داخلية

## 6. ما لا يتغيّر
- `status` و `REQUEST_STATUS_LABEL` و `request_status_history` تبقى كما هي.
- جميع الواجهات الحالية للحالة (Chips, dropdowns) لا تتأثر.
- لا تعديل على الجداول الموجودة عدا إضافة حقول جديدة nullable.

## ملفات سيتم تعديلها/إنشاؤها
- migration واحدة كاملة (enums + columns + جدول events + RLS + triggers)
- `src/lib/staff-assignment.ts` (جديد — labels, helpers, types)
- `src/routes/_authenticated/admin.requests.index.tsx` (فلاتر + عمود)
- `src/routes/_authenticated/admin.requests.$id.tsx` (قسم الإسناد + أزرار)
- `src/routes/_authenticated/admin.index.tsx` (كروت الداشبورد)
- `src/routes/_authenticated/account.requests.$id.tsx` (قسم "متابعة الطلب")
- `src/routes/_authenticated/account.tsx` (عنصر "طلباتي" للموظف)

## أسئلة قبل البدء
1. هل تريد إنشاء صفحة منفصلة `/staff` للموظفين، أم يكفي إعادة استخدام صفحات الإدارة مع تقييد RLS؟ (مقترح: الثاني — أسرع وأبسط)
2. الإشعارات: هل ترسل إشعار للموظف عند الإسناد بالإضافة لإشعار العميل؟ (مقترح: نعم)
3. حذف الإسناد (unassign): هل يلزم سبب إجباري؟ (مقترح: ملاحظة اختيارية)
