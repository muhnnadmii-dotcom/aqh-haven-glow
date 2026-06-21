## البوابة المالية الداخلية — Aqua Haven

بوابة مالية شخصية داخل لوحة الإدارة، بديلة للإكسل، بدون أي تكامل خارجي. مقسّمة على مراحل قابلة للتنفيذ والمراجعة.

---

### المرحلة 1 — قاعدة البيانات والصلاحيات (Migration واحد)

**Enums جديدة:**
- `finance_account_type`: `business`, `personal`
- `finance_internal_review`: `unreviewed`, `reviewed`
- `finance_accountant_status`: `not_reviewed`, `reviewed`, `posted_to_qoyod`, `needs_fix`
- `finance_attachment_status`: `attached`, `not_attached`, `not_required`
- `finance_category_type`: `main`, `sub`
- توسيع `app_role` بـ: `finance_view`, `finance_manage`, `finance_accountant`, `finance_export`, `finance_settings`

**جداول جديدة (كلها في `public` مع GRANT + RLS):**
- `finance_income_sources` (name, is_active, display_order) — مع بذرة: Salla, Tabby, Tamara, Bank
- `finance_categories` (name, type, parent_id, is_active, display_order) — مع بذرة لكل التصنيفات الرئيسية والفرعية المذكورة
- `finance_suppliers` (name, company_name, phone, email, city, country, supplier_type, notes, is_active)
- `finance_incomes` (income_date, amount, income_source_id, month, account_type, note, internal_review_status, accountant_status, accountant_note, attachment_status, created_by)
- `finance_expenses` (expense_date, amount, item_name, supplier_id, supplier_name, main_category_id, sub_category_id, month, account_type, note, internal_review_status, accountant_status, accountant_note, attachment_status, created_by)
- `finance_attachments` (related_type, related_id, file_url, file_name, file_type, attachment_type, uploaded_by)
- `finance_audit_logs` (related_type, related_id, action, field_name, old_value, new_value, changed_by, changed_at, note) — append-only

**Triggers:**
- حساب `month` تلقائيًا من التاريخ (`YYYY-MM`)
- تحديث `attachment_status` تلقائيًا عند رفع/حذف مرفق (إلا إذا `not_required`)
- كتابة `finance_audit_logs` على كل INSERT/UPDATE/DELETE للجداول المالية
- منع حذف تصنيف/مورد مستخدم في عملية

**RLS:**
- العملاء: ممنوع كليًا (لا anon ولا authenticated عاديين)
- `has_role(uid, 'admin')` → كل شيء
- `has_role(uid, 'finance_view')` → SELECT
- `has_role(uid, 'finance_manage')` → INSERT/UPDATE/DELETE على incomes/expenses/suppliers/attachments
- `has_role(uid, 'finance_accountant')` → UPDATE فقط على `main_category_id`, `sub_category_id`, `accountant_status`, `accountant_note` (عبر column-level GRANT + policy)
- `has_role(uid, 'finance_settings')` → إدارة categories + income_sources
- `finance_audit_logs`: قراءة فقط لمن لديه صلاحية مالية، الكتابة عبر trigger فقط

**Storage:**
- bucket خاص: `finance-attachments` (خاص، غير عام) مع policies للصلاحيات المالية فقط

---

### المرحلة 2 — الهيكل والتنقل

- مسار رئيسي: `/admin/finance` مع layout مستقل وقائمة جانبية فرعية
- إخفاء رابط "المالية" في `admin.tsx` إن لم يملك المستخدم أي صلاحية مالية
- حارس `beforeLoad` على `/admin/finance/*` يتحقق من الصلاحية ويعيد التوجيه

الصفحات:
- `/admin/finance` — Dashboard
- `/admin/finance/incomes`
- `/admin/finance/expenses`
- `/admin/finance/suppliers`
- `/admin/finance/categories`
- `/admin/finance/attachments`
- `/admin/finance/export`
- `/admin/finance/audit`
- `/admin/finance/settings`

---

### المرحلة 3 — الواجهات

**Dashboard:** بطاقات (دخل/مصروف الشهر، الصافي، عدّادات المراجعات الناقصة، المصروفات بدون مرفق) + آخر 5 لكل نوع + فلاتر زمنية.

**Incomes & Expenses:**
- جدول مع بحث + فلاتر (شهر، مصدر/مورد، تصنيف، نوع حساب، حالات مراجعة، حالة مرفق)
- Drawer/Dialog لإضافة وتعديل
- التصنيف الفرعي يتفلتر حسب الرئيسي
- شارات ملونة للحالات
- صفحة تفاصيل بها: المرفقات + سجل التعديلات

**Suppliers:** جدول + صفحة مورد بإحصائياته ومصروفاته.

**Categories:** شجرة قابلة للإضافة/الإخفاء/الترتيب.

**Attachments:** عرض موحّد لكل المرفقات مع فلتر حسب النوع/المرتبط بـ.

**Export:** نماذج تصدير CSV/XLSX مع كل الفلاتر المطلوبة (مكتبة `xlsx`).

**Audit Log:** جدول للقراءة فقط مع فلاتر.

**Settings:** إدارة مصادر الدخل + تفعيل/تعطيل التصنيفات.

---

### تفاصيل تقنية

- Server functions في `src/lib/finance/*.functions.ts` مع `requireSupabaseAuth` + فحص دور
- رفع المرفقات: server function تتحقق من الصلاحية ثم تستخدم `supabaseAdmin` للرفع على البكت الخاص
- التصدير: server function ترجع buffer XLSX
- كل التغييرات على الجداول المالية تمر عبر server functions حتى نستطيع تطبيق قواعد المحاسب على مستوى الحقول
- RTL + IBM Plex Sans Arabic (نظام التصميم الحالي)

---

### ما لن يتم لمسه

- صفحة الطلبات وحالاتها
- صفحة العملاء وأحواضهم
- الصفحة الرئيسية
- نظام المساعد
- أي جدول موجود

---

### خطة التنفيذ المقترحة

أقترح تنفيذها على دفعتين لتسهيل المراجعة:

1. **الدفعة الأولى:** Migration كامل (جداول + RLS + بذور + bucket) + هيكل التنقل + صفحات Dashboard/Incomes/Expenses الأساسية.
2. **الدفعة الثانية:** Suppliers + Categories + Attachments + Export + Audit + Settings + تشطيبات.

هل تريد البدء بالدفعة الأولى الآن؟
