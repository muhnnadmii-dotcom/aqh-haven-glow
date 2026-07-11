# وحدة ضريبة القيمة المضافة (VAT)

نظام داخلي مستقل، مبني على الفواتير المعتمدة فقط (accrual). لا زاتكا، لا تقديم إلكتروني، لا XML/QR.

## 1. تعديلات قاعدة البيانات (migration واحدة)

### إعدادات المنشأة — إضافة أعمدة إلى `aqh_business_settings`
كلها nullable / defaults آمنة:
- `vat_registered boolean default false`
- `vat_number text`
- `default_vat_rate numeric(5,2) default 15`
- `filing_frequency text default 'monthly'` — CHECK (monthly, quarterly)
- `first_tax_period_start date`
- `tax_basis text default 'accrual'` — CHECK (accrual, cash)
- `carried_forward_vat_credit numeric(14,2) default 0`
- `commercial_registration text`
- `tax_address text`
(`company_name` موجود مسبقًا)

### جدول جديد: `tax_periods`
- `id uuid pk`, `start_date`, `end_date`, `due_date`
- `status tax_period_status` enum: open, under_review, ready, filed, paid, closed
- `carried_credit_in/used/out numeric(14,2) default 0`
- `filed_at, paid_at timestamptz nullable`, `notes text`
- `UNIQUE (start_date, end_date)` لمنع التكرار
- created_at/updated_at + trigger touch

### جدول جديد: `tax_return_snapshots`
لتجميد أرقام الإقرار عند marked_as_filed:
- `id uuid pk`, `period_id uuid fk tax_periods`
- `status text` (draft, under_review, approved_internally, marked_as_filed)
- `summary jsonb` — كل خانات الإقرار
- `line_items jsonb` — تفاصيل المستندات المشاركة
- `filed_at, filed_by`, `override_reason text`
- `UNIQUE (period_id, status='marked_as_filed')` عبر partial index

### دوال DB (SECURITY DEFINER، صلاحيات finance فقط)
- `vat_get_period_summary(p_period_id)` → الأرقام الحية للوحة والمسودة
- `vat_get_sales_lines(p_period_id, p_filter)` → صفوف ضريبة المبيعات
- `vat_get_purchase_lines(p_period_id, p_filter)` → صفوف ضريبة المشتريات
- `vat_get_excluded_invoices(p_period_id)` → مع سبب الاستبعاد
- `vat_validate_return(p_period_id)` → أخطاء حرجة + تحذيرات
- `vat_mark_as_filed(p_period_id, p_override_reason)` → snapshot + سجل audit

### الأمن
- RLS على `tax_periods` و`tax_return_snapshots`: قراءة/كتابة للـ finance roles فقط عبر `private.has_any_finance_role()`
- GRANT SELECT/INSERT/UPDATE على `authenticated` مع policies
- audit logs في `finance_audit_logs` عند: إنشاء فترة، اعتماد داخلي، marked_as_filed، تعديل carried_credit

## 2. مصدر الأرقام (accrual فقط الآن)

المخرجات (مبيعات):
```sql
FROM sales_invoices
WHERE status IN ('approved','partially_paid','paid')
  AND COALESCE(supply_date, issue_date) BETWEEN period.start AND period.end
```
تُصنّف عبر `sales_invoice_items.tax_code`: standard_15 / zero / exempt / out_of_scope.

المدخلات (مشتريات):
```sql
FROM purchase_invoices
WHERE status IN ('approved','partially_paid','paid')
  AND COALESCE(supply_date, issue_date) BETWEEN period.start AND period.end
```
مقسّم حسب `vat_deductibility`: fully/partially/non/pending. غير القابل للخصم يظهر لكن لا يخصم من المستحق.

**الأساس النقدي**: يعرض banner تنبيه، ويحوّل تلقائيًا للـ accrual داخليًا مع رسالة. لا تُنفَّذ حسابات نقدية.

## 3. الصفحات (7)

كلها تحت `/admin/finance/vat/*` وتلتزم بنفس تصميم صفحات المالية الحالية (RTL، dark، gold accent، cards/tables الحالية).

1. **لوحة الضريبة** `admin.finance.vat.index.tsx`
   - Period picker + KPI cards: مبيعات خاضعة، مخرجات، مشتريات خاضعة، مدخلات، قابل للخصم، صافي المستحق/الدائن
   - عدادات فرعية: تنتظر مراجعة، بدون مرفق، مكررة/مشتبه بها
2. **ضريبة المبيعات** `admin.finance.vat.sales.tsx`
3. **ضريبة المشتريات** `admin.finance.vat.purchases.tsx`
4. **الفواتير المستبعدة** `admin.finance.vat.excluded.tsx`
5. **الفترات الضريبية** `admin.finance.vat.periods.tsx`
6. **مسودة الإقرار** `admin.finance.vat.draft.tsx` — مع validator أخطاء/تحذيرات + زر marked_as_filed
7. **الإقرارات السابقة** `admin.finance.vat.filed.tsx` — عرض snapshots المجمّدة

جميع KPIs والصفوف قابلة للنقر لفتح drawer يعرض المستندات المكوّنة للرقم (تتبع الأرقام).

## 4. تصدير
- Excel: sales / purchases / excluded (باستخدام `exportXLSX` الموجودة)
- PDF: طباعة المسودة عبر `window.print()` (نفس آلية reports الحالية)

## 5. القائمة
إضافة مجموعة "ضريبة القيمة المضافة" في sidebar admin مع الروابط السبعة.

## 6. الحماية من التكرار
- زر marked_as_filed idempotent: يتحقق من وجود snapshot بنفس period_id قبل الإدراج
- إنشاء الفترة: UNIQUE constraint + upsert
- كل RPC كتابة تحقق من الصلاحية + audit log

## نقاط لن تُنفَّذ (حسب الطلب)
- ربط زاتكا / فوترة إلكترونية / XML / QR
- تقديم آلي للإقرار
- منطق الأساس النقدي الكامل (نُعرض banner فقط ونحوّل إلى accrual)

## معايير القبول (checklist للاختبار)
1. ✅ ضريبة المخرجات من `sales_invoices` معتمدة فقط
2. ✅ ضريبة المدخلات من `purchase_invoices` معتمدة فقط
3. ✅ non_deductible يظهر لكن لا يخصم من المستحق
4. ✅ drawer تتبع كل رقم إلى مستنداته
5. ✅ snapshot مجمّد بعد marked_as_filed — لا يتأثر بتعديلات لاحقة
