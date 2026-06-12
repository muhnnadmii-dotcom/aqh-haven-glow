## الهدف
إضافة حقول خاصة بالأحواض البحرية في نموذج «حوض جديد / تعديل حوض» داخل حساب العميل، تظهر فقط عندما يكون `tank_type = "marine"`، وتُعرض للأدمن عند فتح طلبات الاستشارة / الصيانة المرتبطة بهذا الحوض.

## 1. تعديلات قاعدة البيانات

### جدول `customer_tanks` — أعمدة جديدة (كلها اختيارية / nullable)

**معدات بحرية**
- `has_protein_skimmer` boolean
- `protein_skimmer_model` text
- `has_wave_maker` boolean
- `wave_maker_model` text
- `has_sump` boolean
- `has_ato` boolean
- `salt_brand` text
- `salinity` numeric
- `marine_temperature` numeric
- `last_water_change` date
- `water_change_percent` numeric

**إضاءة بحرية**
- `marine_light_type` text
- `white_light_hours` numeric
- `blue_light_hours` numeric
- `coral_safe_light` text  — قيم: `yes` / `no` / `unknown`

**المرجان**
- `has_coral` boolean
- `corals` jsonb — مصفوفة `[{ type, count, notes }]`

**فحوصات بحرية** (اختيارية، تُحفظ على الحوض مباشرة لسهولة العرض في الطلبات)
- `test_salinity` numeric
- `test_ph` numeric
- `test_kh` numeric
- `test_calcium` numeric
- `test_magnesium` numeric
- `test_nitrate` numeric
- `test_phosphate` numeric
- `test_ammonia` numeric
- `test_nitrite` numeric
- `tests_updated_at` timestamptz

> ملاحظة: جدول `water_tests` الموجود يبقى كما هو للتاريخ الزمني للفحوصات. الحقول الجديدة هي «آخر قيم معروفة» تُعرض مباشرة مع الحوض.

لا تغييرات على RLS / GRANTs — الجدول موجود وسياساته الحالية تغطي الأعمدة الجديدة تلقائيًا.

## 2. نموذج الحوض في حساب العميل
ملف: `src/routes/_authenticated/account.tanks.tsx`

- توسيع نوع `Tank` والـ `blank` initializer بالحقول الجديدة.
- إضافة شرط `isMarine = v.tank_type === "marine"`.
- عرض أقسام جديدة فقط عندما `isMarine`:
  1. **«معدات الحوض البحري»** — checkboxes للأجهزة + حقول الموديل تظهر شرطيًا عند التفعيل + ملح / ملوحة / حرارة / آخر تغيير ماء / نسبة التغيير.
  2. **«الإضاءة البحرية»** — نوع، ساعات الأبيض، ساعات الأزرق، مناسبة للمرجان (radio: نعم/لا/لا أعلم).
  3. **«المرجان»** — checkbox `has_coral`، عند التفعيل: قائمة ديناميكية `[{type, count, notes}]` بزر إضافة وحذف (نفس نمط `livestock_items`/`plants` الحالي).
  4. **«الفحوصات (اختياري)»** — 9 حقول رقمية في شبكة.
- تحديث `fromRow` و `save` لتمرير الحقول الجديدة.
- إخفاء/إظهار قسم النباتات الحالي يبقى كما هو (عذب / نباتي فقط) — لا تغيير على المنطق الموجود.

## 3. عرض البيانات في لوحة الأدمن
ملف: `src/routes/_authenticated/admin.requests.tsx`

عند فتح تفاصيل طلب من نوع `consultation` أو `maintenance` ومرتبط بحوض `tank_type = "marine"`:
- جلب الحوض كاملاً (موجود مسبقًا أو إضافة fetch مختصر إن لزم).
- إضافة بطاقة «بيانات الحوض البحري» تعرض فقط الحقول التي لها قيمة (Equipment / Lighting / Corals / Tests) مع تنظيم بسيط.
- الحقول الفارغة تُخفى لتفادي الفوضى.

## 4. متطلبات عامة
- RTL محفوظ (التصميم يستخدم نفس `glass` / `inp` / `lbl` patterns الحالية).
- تجربة الجوال: شبكات `grid sm:grid-cols-2` مع `gap-4`.
- لا تكسير لأي حقل موجود؛ كل الأعمدة الجديدة nullable.
- الأحواض غير البحرية لا تتأثر إطلاقًا.

## الملفات المتأثرة
- migration جديدة: إضافة الأعمدة لـ `customer_tanks`.
- `src/routes/_authenticated/account.tanks.tsx` (تعديل).
- `src/routes/_authenticated/admin.requests.tsx` (إضافة بطاقة بحرية مشروطة).
- `src/integrations/supabase/types.ts` يُحدَّث تلقائيًا بعد الـ migration.

## ملخص بعد التنفيذ (سيُعرض لاحقًا)
- الحقول المضافة.
- مكان ظهورها في حساب العميل.
- مكان عرضها للأدمن.
