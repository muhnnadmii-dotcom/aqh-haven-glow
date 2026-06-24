# خطة ميزة المخزون / إعادة التوريد — المرحلة الأولى

## ⚠️ ملاحظة قبل التنفيذ
ذكرت أن جدولَي `aqh_products` و `aqh_restock_requests` تم إنشاؤهما عبر migration. الفحص الحالي للقاعدة لا يُظهر وجودهما (`information_schema.columns` فارغ لهذين الاسمين).

قبل البدء أحتاج تأكيد واحد:
- **الخيار أ:** الجدولان موجودان فعلاً وأنا أحتاج فقط أن تشاركني السكيمة (أعمدة + قيم enum للحالات) لأبني عليها بدون تعديل.
- **الخيار ب:** الجدولان لم يُنشآ بعد، وتسمح لي بإضافة migration واحد جديد يُنشئ **فقط** `aqh_products` و `aqh_restock_requests` (مع GRANT + RLS بنفس النمط الموجود)، دون لمس أي جدول قائم.

البقية أدناه تفترض السكيمة قياسية (الخيار ب أو سكيمة مطابقة في الخيار أ). أوقف التنفيذ إن اختلفت السكيمة.

---

## 1) السكيمة المتوقعة (للتحقق فقط — لا تُنشأ إن كانت موجودة)

`public.aqh_products`
- `id uuid pk`, `sku text`, `name_ar text`, `name_en text`, `category text`, `unit text`, `notes text`, `is_active boolean`, `created_at`, `updated_at`

`public.aqh_restock_requests`
- `id uuid pk`, `product_id uuid → aqh_products(id)`, `qty numeric`, `status text check in ('new','ordered','received')` (افتراضي `new`), `requested_by uuid → auth.users`, `notes text`, `ordered_at`, `received_at`, `created_at`, `updated_at`

**GRANT + RLS (الخيار ب فقط):**
- `GRANT SELECT,INSERT,UPDATE,DELETE ... TO authenticated; GRANT ALL ... TO service_role;`
- سياسات: `USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))` على SELECT/INSERT/UPDATE. لا DELETE من الواجهة.
- لا تعديل على أي جدول قائم. لا triggers على schemas محمية.

## 2) المسار والـ Sidebar

| التغيير | الملف |
|---|---|
| إنشاء صفحة جديدة `/_authenticated/admin/inventory` | `src/routes/_authenticated/admin.inventory.tsx` |
| إضافة عنصر `{ to:"/admin/inventory", label:"المخزون", icon: Package }` داخل مجموعة `ops` في `navGroups` | `src/routes/_authenticated/admin.tsx` (السطور 35–45) |
| تسجيل المسار في كاتالوج صلاحيات الأدوار المخصصة | `src/lib/admin-pages.ts` (إضافة عنصر `{ key:"/admin/inventory", label:"المخزون", group:"ops" }`) |

> رغم أن الميزة في مجموعة "التشغيل" غير قابلة للطي (كما طلبت سابقاً)، ستكون قابلة للوصول من نفس مجموعة `ops`. لو رغبت بمجموعة منفصلة لاحقاً (Restock وحدها)، نضيفها كنواة لتوسعات لاحقة.

**الحماية:** `beforeLoad` الحالي في `admin.tsx` يسمح فقط بـ `admin|staff|finance_*`. سنضيف `beforeLoad` ثانٍ خاص بصفحة `/admin/inventory` يتحقق من `admin|staff` فقط (يستثني أدوار المالية البحتة) عبر `user_roles`. كذلك المسار يبقى محترَماً من `useAllowedPages`/`RouteAccessGate` تلقائياً بفضل تسجيله في `admin-pages.ts`.

## 3) صفحة `/admin/inventory` — تبويبتان

استخدام `Tabs` من shadcn، RTL، نفس الهوية (deep navy + gold). أيقونة `Package` من `lucide-react`.

### تبويب «طلب توريد»
- استعلام `aqh_products` (`is_active=true`) عبر `supabase` المتصفّحي.
- بحث نصي على `name_ar / name_en / sku` + فلتر `category` (Select).
- بطاقة/صف لكل منتج مع زر «اطلب توريد» يفتح Dialog يحوي: الكمية + ملاحظة اختيارية → INSERT في `aqh_restock_requests` بحالة `new` + `requested_by = auth.uid()`.
- toast نجاح + invalidate لقائمة الطلبات.

### تبويب «الطلبات»
- جدول مرتب تنازلياً حسب `created_at`، يُظهر: المنتج (join بسيط)، الكمية، الحالة كـ Badge بألوان الهوية (new=رمادي، ordered=ذهبي، received=أخضر هادئ)، طالب التوريد (من `profiles`)، التاريخ.
- فلاتر: الحالة + بحث باسم المنتج + نطاق تاريخ.
- تغيير الحالة inline عبر `Select` صغير: `new → ordered → received` (يتقدّم خطوة واحدة فقط). UPDATE يضبط `ordered_at`/`received_at` حسب الانتقال.
- زر **«تصدير CSV»** لكل صف (تصدير سطر واحد) — تنفيذ في المتصفح بدون مكتبات إضافية: بناء `Blob` نصي UTF-8 + BOM وتنزيله. (إن طلبت لاحقاً تصدير دفعة كاملة، نضيفه.)

## 4) قواعد التنفيذ
- بيانات Supabase عبر `import { supabase } from "@/integrations/supabase/client"` فقط (لا server functions في هذه المرحلة، لأن RLS كافٍ والصفحة مغلقة بـ `_authenticated`).
- TanStack Query (`useQuery`/`useMutation`) بنفس النمط المستخدم في صفحات الإدارة الحالية.
- نصوص عربية، اتجاه RTL موروث من التخطيط الحالي، خط IBM Plex Sans Arabic، tokens التصميم الموجودة.
- لا `useEffect+fetch`، لا hardcoded colors، لا تعديل لأي ملف خارج المذكور.

## 5) خارج النطاق (تأكيد)
لا مساس بـ: المالية، الطلبات/الخدمات، العملاء، الأحواض، محتوى الموقع، RLS القائمة، Salla، الإشعارات، إدارة المنتجات. لا خصم تلقائي للمخزون. لا واجهة CRUD للمنتجات (تأتي من seed/migration فقط).

## 6) ملفات سيتم تعديلها/إنشاؤها
- **جديد:** `src/routes/_authenticated/admin.inventory.tsx`
- **تعديل:** `src/routes/_authenticated/admin.tsx` (إضافة عنصر nav واحد + استيراد أيقونة `Package`)
- **تعديل:** `src/lib/admin-pages.ts` (إضافة سطر واحد في `ADMIN_PAGES`)
- **(الخيار ب فقط) migration جديد:** ينشئ `aqh_products` + `aqh_restock_requests` + GRANT + RLS + seed أولي للمنتجات إن زوّدتني بقائمة.

## 7) التحقق بعد التنفيذ
- type-check + build يمران.
- اختبار يدوي: تسجيل دخول admin → الصفحة تظهر، إنشاء طلب توريد، نقل الحالة، تصدير CSV. تسجيل دخول staff → نفس الصلاحيات. تسجيل دخول finance_view فقط → لا يرى الرابط ولا يدخل المسار (يُحال).

---

### رجاءً أكّد:
1. الخيار أ أم ب بخصوص الجدولين؟
2. إن كان (أ): شارك أسماء الأعمدة وقيم enum للحالات.
3. إن كان (ب): هل أُضمّن seed منتجات افتراضي، أم أتركه فارغاً تُعبّئه أنت لاحقاً؟
