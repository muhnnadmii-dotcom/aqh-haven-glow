# مساعد الحوض - المرحلة الأولى

## الهدف
تحويل صفحة الحوض في حساب العميل إلى مركز متابعة سريع: تسجيل العناية، القراءات، الصور، الملاحظات والمشاكل خلال أقل من 20 ثانية.

## النطاق (ما لن يتغير)
- لا تعديل على نظام الطلبات الحالي أو حالاتها
- لا تعديل على الصفحة الرئيسية أو لوحة الإدارة
- لا حذف بيانات
- التعديلات محصورة في: `src/routes/_authenticated/account.tanks.$id.tsx` + ملفات جديدة

## قاعدة البيانات (Migration واحدة)

جداول جديدة فقط (لا نلمس `customer_tanks` الحالي):

1. **`aquarium_care_logs`** — `tank_id, user_id, log_type (status_update|water_change|note|issue|photo|reading), status (excellent|normal|needs_attention|problem|null), water_change_percentage, note, image_paths[], details (jsonb), created_at`
2. **`aquarium_readings`** — `tank_id, user_id, temperature, ph, ammonia, nitrite, nitrate, tds, salinity, kh, calcium, magnesium, phosphate, reading_date, note, created_at`
3. **`aquarium_issues`** — `tank_id, user_id, issue_type, description, status (open|closed), image_paths[], created_at, updated_at`
4. **`aquarium_tasks`** — `tank_id, user_id, task_type (water_change|reading|check), title, due_date, completed_at, status, created_at`

**ملاحظة:** الصور تستخدم نفس bucket الموجود `media`. سنستخدم جدول `aquarium_care_logs` الموحّد كـ timeline، مع جداول مخصصة للقراءات والمشاكل والمهام لاستعلامات أسرع.

**RLS:** كل جدول → العميل يرى/يضيف لأحواضه فقط (عبر `EXISTS` على `customer_tanks.user_id = auth.uid()`). admin/staff يقرؤون عبر `has_role`.

**GRANT:** `SELECT, INSERT, UPDATE, DELETE` لـ `authenticated` و `ALL` لـ `service_role`.

## الواجهة - صفحة الحوض

ملف رئيسي: `src/routes/_authenticated/account.tanks.$id.tsx` يضيف في الأعلى مكونات جديدة دون تغيير المحتوى الحالي (الصور، التقارير، التحاليل الحالية تبقى).

### مكونات جديدة (تحت `src/components/aquarium-assistant/`)

1. **`AquariumAssistantPanel.tsx`** — القسم العلوي، يعرض:
   - حالة الحوض اليوم (محسوبة) + مؤشر لون
   - 5 بطاقات ملخص: آخر تغيير ماء، آخر قراءة، آخر صورة، المهمة القادمة، آخر ملاحظة
   - نص فارغ: "ابدأ بتسجيل أول تحديث لحوضك" إذا لا بيانات

2. **`QuickActionsBar.tsx`** — صف أزرار كبيرة (touch-friendly):
   - تحديث سريع · سجل تغيير ماء · سجل قراءة · أضف صورة · أضف ملاحظة · عندي مشكلة · اطلب صيانة (Link → `/account/requests/new?type=maintenance&tank=...`)

3. **`QuickUpdateSheet.tsx`** — Bottom sheet (Drawer على الجوال، Dialog على Desktop):
   - اختيار حالة (ممتاز/طبيعي/يحتاج متابعة/مشكلة) + ملاحظة/صورة/قراءة اختيارية
   - رسالة نتيجة حسب الحالة

4. **`WaterChangeSheet.tsx`** — خيارات 10/20/30/50/مخصص + ملاحظة + صورة → يحفظ + يعرض موعد التغيير القادم (حسب `tank_type`: بحري=14، باقي=7)

5. **`ReadingSheet.tsx`** — حقول حسب نوع الحوض (نهري/نباتي vs بحري). كل الحقول اختيارية. تحذير هادئ إذا قراءة خارج النطاق

6. **`PhotoSheet.tsx`** — رفع 1+ صورة عبر `ImageUploader` الموجود + ملاحظة

7. **`NoteSheet.tsx`** — نوع الملاحظة (عامة/سمك/نبات/ماء/جهاز/أخرى) + نص + صورة اختيارية

8. **`IssueSheet.tsx`** — نوع المشكلة + وصف + صورة + checkbox "أريد متابعة من Aqua Haven" (يحفظ فقط، لا ينشئ طلب)

9. **`CareTimeline.tsx`** — قسم "سجل العناية" أسفل اللوحة، يقرأ من `aquarium_care_logs` + `aquarium_readings` + `aquarium_issues` مدمجة ومرتبة بـ `created_at` تنازليًا. كل عنصر: أيقونة + نوع + تاريخ + ملخص + صورة إن وجدت

### منطق مؤشر الحالة (في `AquariumAssistantPanel`)
```
if (آخر مشكلة مفتوحة) → "توجد مشكلة"
else if (آخر تغيير ماء > 14 يوم) → "يحتاج متابعة"
else if (آخر قراءة خارج النطاق) → "يحتاج متابعة"
else if (آخر تحديث حالة = excellent) → "ممتاز"
else → "مستقر"
```
+ سطر تنبيه صغير: "مؤشر مبسط للمتابعة، لا يغني عن فحص مختص."

## ملف مساعد
- `src/lib/aquarium-assistant.ts` — أنواع، نطاقات القراءات الطبيعية، دالة `computeTankStatus`، حساب "قبل X أيام" بالعربي

## التجربة على الجوال
- جميع الأزرار `min-h-12` ومتباعدة
- استخدم `Drawer` (موجود في `components/ui/drawer.tsx`) لكل الـ sheets على الجوال
- لا فورم > 4 حقول مرة واحدة

## الاختبار اليدوي (بعد التنفيذ)
كما حدده المستخدم في القسم 15.

## الترتيب
1. Migration (تحتاج موافقة)
2. بعد الموافقة: ملفات lib + المكونات + تعديل صفحة الحوض
