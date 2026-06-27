# توحيد الموردين (المخزون + المالية)

سيتم إلغاء جدول `aqh_suppliers` المنفصل واعتماد `finance_suppliers` كمصدر وحيد للموردين في كامل النظام.

## التغييرات على قاعدة البيانات

1. **تعديل `aqh_product_suppliers`:**
   - إضافة عمود جديد `finance_supplier_id uuid` يشير إلى `finance_suppliers(id)`.
   - ترحيل البيانات: لكل صف موجود، البحث عن مورد المالية المطابق بالاسم (أو إنشاء واحد جديد من بيانات `aqh_suppliers` إذا لم يوجد).
   - حذف العمود القديم `supplier_id bigint`.
   - إعادة بناء قيد الفرادة `UNIQUE (product_id, finance_supplier_id)`.

2. **تعديل `aqh_restock_requests`:**
   - إذا كان فيه `supplier_id` يشير إلى `aqh_suppliers`، تحويله إلى `finance_supplier_id uuid` بنفس آلية الترحيل.

3. **حذف جدول `aqh_suppliers`** بعد نقل أي مورد غير موجود في المالية إليها.

4. **دالة `aqh_bulk_update_products`:** تعديل `p_supplier_id` ليصبح `uuid` بدل `bigint`.

## التغييرات على الواجهة

- **حذف صفحة `/admin/inventory/suppliers`** وبند القائمة الجانبية المقابل لها.
- **إعادة توجيه** أي رابط قديم لصفحة موردي المخزون إلى `/admin/finance/suppliers` (الصفحة الموجودة فعلياً للموردين الماليين).
- **`admin.inventory.products.tsx`:** تحديث منتقي المورد (SupplierPicker / dialog ربط الموردين) ليقرأ من `finance_suppliers` ويستخدم `id` من نوع `uuid`.
- **`admin.inventory.index.tsx` (لوحة المخزون):** بطاقة "الموردين النشطين" تقرأ من `finance_suppliers` (مع فلتر `is_active`).
- **`admin.inventory.reports.tsx`:** أي تجميع بحسب المورد يستخدم `finance_suppliers`.
- **`admin.inventory.catalog.tsx`** و**`admin.inventory.requests.tsx`:** أي عرض لاسم المورد يستخدم `finance_suppliers`.
- **`src/lib/admin-pages.ts`:** إزالة مدخل صفحة موردي المخزون من قائمة صلاحيات الأدمن.

## ملاحظات

- جميع المنتجات المربوطة حالياً بـ "دنيا الربيع" في `aqh_suppliers` ستُربط بالمورد المطابق في `finance_suppliers` (سيتم إنشاؤه إن لم يوجد).
- لن يكون هناك بعد ذلك سوى مكان واحد لإدارة الموردين: `/admin/finance/suppliers`.
- لن تُحذف أي بيانات منتجات أو روابط — فقط إعادة توجيه المفاتيح.
