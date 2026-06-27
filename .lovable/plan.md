
# نظام المخزون المتكامل · AQH

## الهدف
لوحة تحكم احترافية للمنتجات والمخزون مع ربط متعدد بين المنتجات والموردين، قائمة جانبية واضحة، وعمليات CRUD كاملة + تعديل جماعي.

## بنية البيانات الجديدة

نضيف جدولين جديدين دون لمس الجداول الحالية (نحافظ على البيانات):

1. **`aqh_suppliers`** — قائمة الموردين الرسمية
   - `id`, `key` (مثل dunya_rabee)، `name_ar`, `name_en`, `phone`, `email`, `notes`, `is_active`
2. **`aqh_product_suppliers`** — جدول ربط Many-to-Many
   - `product_id` → aqh_products، `supplier_id` → aqh_suppliers
   - `supplier_sku`, `cost`, `lead_time_days`, `is_preferred`
3. **`aqh_product_categories`** — تصنيفات منظمة
   - `id`, `name_ar`, `slug`, `parent_id`, `sort_order`

نُرحّل التصنيفات الموجودة من حقل `category` النصي في `aqh_products`، ونبقي الكاتلوج القديم (`aqh_supplier_products`) كمصدر مرجعي للأسعار.

## القائمة الجانبية الجديدة (مجموعة "المخزون")

```text
المخزون
├── 📊 لوحة المخزون          /admin/inventory
├── 📦 المنتجات                /admin/inventory/products
├── 🏷️ التصنيفات              /admin/inventory/categories
├── 🚚 الموردين                /admin/inventory/suppliers
├── 📖 كاتلوج دنيا الربيع     /admin/inventory/catalog
├── 📋 طلبات التوريد          /admin/inventory/requests
└── 📈 تقارير المخزون         /admin/inventory/reports
```

## الصفحات والمحتوى

### 1) لوحة المخزون (Dashboard)
بطاقات سريعة: إجمالي المنتجات، منتجات منخفضة المخزون، طلبات مفتوحة، قيمة المخزون، أكثر الموردين نشاطاً، آخر 5 طلبات.

### 2) إدارة المنتجات (الصفحة الرئيسية الجديدة)
- جدول بكل المنتجات مع: صورة، SKU، الاسم، التصنيف، الكمية، التكلفة، الموردون المرتبطون، الحالة
- بحث + فلاتر (تصنيف، مورد، حالة، مستوى المخزون)
- **CRUD كامل**: إضافة منتج جديد، تعديل، حذف، تفعيل/تعطيل
- **تعديل جماعي**: تحديد عدة منتجات → تغيير (التصنيف، السعر بنسبة %، المورد، الحالة، نوع التوريد) دفعة واحدة
- شاشة تفاصيل منتج: معلومات أساسية + لائحة الموردين المرتبطين (إضافة/إزالة/تحديد المفضّل) + سجل حركة الكميات
- استيراد CSV (اختياري في مرحلة لاحقة)

### 3) إدارة التصنيفات
شجرة تصنيفات: إضافة/تعديل/حذف/ترتيب بالسحب، عداد المنتجات لكل تصنيف.

### 4) إدارة الموردين
- جدول الموردين: اسم، جهة اتصال، عدد المنتجات، حالة
- CRUD كامل + صفحة تفاصيل المورد فيها المنتجات المرتبطة + إجمالي قيمة الطلبات السابقة

### 5) كاتلوج دنيا الربيع (موجود)
نضيف زر "ربط بمنتج داخلي" بجانب كل صف من الكاتلوج، يفتح نافذة لاختيار/إنشاء منتج في `aqh_products` ويربطه عبر `aqh_product_suppliers`.

### 6) طلبات التوريد (موجود)
يبقى مع تحسين الفلاتر.

### 7) تقارير المخزون
حركة الأصناف، تكلفة المشتريات شهرياً، أداء الموردين.

## CRUD والأذونات

- جميع الجداول الجديدة: RLS مع `GRANT` كامل لـ `authenticated` و `service_role`
- السياسات: `admin` و `staff` فقط (عبر `has_role`)
- كل عملية تعديل جماعي تمرّ من خلال RPC واحد لتفادي عدة طلبات

## تفاصيل تقنية

- **ملفات جديدة**:
  - `src/routes/_authenticated/admin.inventory.products.tsx`
  - `src/routes/_authenticated/admin.inventory.products.$id.tsx` (تفاصيل منتج)
  - `src/routes/_authenticated/admin.inventory.categories.tsx`
  - `src/routes/_authenticated/admin.inventory.suppliers.tsx`
  - `src/routes/_authenticated/admin.inventory.suppliers.$id.tsx`
  - `src/routes/_authenticated/admin.inventory.requests.tsx` (فصل من index)
  - `src/routes/_authenticated/admin.inventory.reports.tsx`
  - مكونات مشتركة: `ProductFormDialog`, `BulkEditDialog`, `SupplierPicker`, `CategoryTree`
- **تعديلات**:
  - `admin.inventory.index.tsx` → يصبح لوحة dashboard فقط
  - `admin.tsx` → تحديث القائمة الجانبية (إضافة 5 عناصر فرعية)
  - `admin.inventory.catalog.tsx` → إضافة زر "ربط بمنتج"
- **هجرتان SQL**:
  1. إنشاء `aqh_suppliers`, `aqh_product_suppliers`, `aqh_product_categories` + GRANTs + RLS + ترحيل التصنيفات النصية الموجودة
  2. إضافة فهارس وRPCs لـ `bulk_update_products` و `link_supplier_product`

## ترتيب التنفيذ (مرحلتان)

**المرحلة 1 (الأساس):**
1. هجرة قاعدة البيانات (الجداول الجديدة + GRANT + RLS)
2. القائمة الجانبية الجديدة
3. لوحة المخزون (dashboard)
4. صفحة المنتجات (CRUD + تعديل جماعي)
5. صفحة الموردين (CRUD)

**المرحلة 2 (الإكمال):**
6. صفحة التصنيفات
7. ربط الكاتلوج بالمنتجات
8. صفحة التقارير
9. فصل صفحة الطلبات

## ملاحظات
- لا نمسّ `aqh_supplier_products` (الكاتلوج) ولا `aqh_restock_requests` بنيوياً، فقط نضيف فوقها
- البيانات الحالية (662 منتج، 329 صف كاتلوج، 3 طلبات) تبقى كما هي
- يمكن لاحقاً ربط منتجات الكاتلوج تلقائياً بالموردين عبر `supplier_key`
