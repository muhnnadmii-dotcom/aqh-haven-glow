## الهدف
إضافة كتالوج الموردين (329 منتجاً من 7 موردين) وربطه بطلبات إعادة التوريد، مع واجهة تتيح للموظفين تصفّح الكتالوج وإنشاء طلب توريد بسعر تلقائي (شامل ضريبة 15%).

## ملاحظة مهمة على SQL المرسل
الـ SQL يستخدم `public.aqh_is_staff()` وهذه الدالة **غير موجودة** في المشروع. النمط المعتمد حالياً (مثلاً في `aqh_restock_requests`) هو:
```
private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff')
```
سأستخدم نفس النمط في السياسات حتى لا نكسر الاتساق.

## 1) Migration
- إنشاء جدول `public.aqh_supplier_products` (نفس الأعمدة المطلوبة).
- فهارس على `supplier_key` و `name`.
- GRANT للـ authenticated + service_role (قاعدة المشروع).
- تفعيل RLS + سياستان (قراءة/كتابة) للـ admin/staff عبر `private.has_role`.
- إضافة الأعمدة الجديدة على `aqh_restock_requests`:
  `source` (internal | supplier_catalog) ، `supplier_key`، `subtotal`، `vat`، `total`.
- إدراج الـ 329 صفًا (دفعة واحدة) — مع الإبقاء على `needs_review=true` لمنتجات BOYU و Dolphin (الأسعار تحتاج تأكيد).

## 2) واجهة الإدارة
- صفحة جديدة `/admin/inventory/suppliers` (تحت قسم المخزون):
  - فلاتر: المورد (تبويبات/Select) + بحث بالاسم/الباركود/الـItem No.
  - جدول: الاسم، Item No، الباركود، السعر (قبل الضريبة)، شارة "يحتاج مراجعة"، زر "أضف لطلب".
  - عربة جانبية (Cart) تجمع المنتجات من نفس المورد فقط، تحسب: Subtotal + VAT 15% + Total، ثم زر "إنشاء طلب توريد".
- عند الإنشاء: نُدرج صفاً في `aqh_restock_requests` بـ:
  `source='supplier_catalog'`, `supplier_key`, `items` (JSON بأسماء وأسعار وكميات)، `items_count`، `subtotal`، `vat`، `total`.
- في صفحة `admin.inventory` الحالية: إضافة بطاقة/تبويب يربط لصفحة الكتالوج الجديدة، وإظهار `source` و`total` ضمن قائمة الطلبات الموجودة.

## 3) تفاصيل تقنية
- ملف الـ Migration واحد فقط يحتوي كل ما سبق (تركيب + بيانات).
- الـ UI كله Client Side عبر `@/integrations/supabase/client` (لأن RLS تكفي والمستخدم staff/admin).
- تنسيق RTL وألوان الـ AQH (gold/dark) كباقي صفحات الإدارة.
- لا تغييرات على الواجهة العامة للموقع.

## ما سيتم تعديله/إضافته
- جديد: `supabase/migrations/<ts>_aqh_supplier_catalog.sql`
- جديد: `src/routes/_authenticated/admin.inventory.suppliers.tsx`
- تعديل: `src/routes/_authenticated/admin.inventory.tsx` (رابط للكتالوج + عرض total/source)
- تعديل بسيط: `src/routes/_authenticated/admin.tsx` (إضافة الرابط للسايدبار إن لزم)

هل أبدأ التنفيذ بهذا الشكل؟ (سأستخدم `private.has_role` بدل `aqh_is_staff` كما أوضحت).