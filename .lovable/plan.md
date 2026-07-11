# تطوير لوحة المالية — تقسيم إلى نقد ومحاسبي

## نطاق العمل
تعديل على النظام المالي القائم فقط. الاحتفاظ بالتصميم الحالي (RTL، الوضع الداكن، البطاقات، الرسومات) وإعادة استخدام المكونات الحالية (`FinanceRowsDrawer`، `dashboard-data.ts`، Recharts، `capital.ts`، `manual-balances.ts`).

## 1. تقسيم لوحة المالية إلى تبويبين
داخل `admin.finance.index.tsx` نفس الصفحة، إضافة `Tabs`:

### تبويب "لوحة النقد" (افتراضي)
يستخدم نفس البطاقات الحالية دون تغيير مظهرها، مع إعادة تنظيم:
- رصيد الحسابات (من `finance_accounts` + `computeLiveCash`)
- إجمالي المقبوضات / المدفوعات / صافي التدفق (موجودة)
- التدفق النقدي التشغيلي = مقبوضات تشغيلية − مدفوعات تشغيلية (استبعاد `transaction_type` من مجموعة owner_contribution/withdrawal/internal_transfer)
- مساهمات المالك / سحوبات المالك / التحويلات الداخلية (بطاقات منفصلة موجودة جزئيًا)
- تحصيلات النشاط في الحساب الشخصي: `finance_incomes` حيث `account.account_owner_type='owner'` و`business_relation='business'`
- مبالغ مستحقة للمالك / صافي جاري المالك (من `get_owner_current_account` الموجودة)
- الحركات غير المصنفة (موجودة)
- آخر الحركات + أرصدة الحسابات + رسم المقبوضات/المدفوعات (موجودة)

### تبويب "لوحة الأداء المحاسبي" (جديد)
مصدر البيانات: `sales_invoices` المعتمدة، `purchase_invoices` المعتمدة، و`journal_entry_lines` للقيود المرحّلة عبر `get_trial_balance`.

RPC جديد `get_accounting_performance(p_from date, p_to date)` يعيد:
- `gross_sales`, `sales_discounts`, `net_sales` من `sales_invoices` (approved/partially_paid/paid)
- `cogs` من رصيد حساب `cost_of_goods_sold` (إن وُجد رصيد، وإلا `NULL`)
- `gross_profit` = net_sales − cogs (فقط إذا cogs ليس NULL)
- `operating_expenses` من مجاميع حسابات النوع `expense` (باستثناء `owner_drawings`)
- `net_profit` = gross_profit − operating_expenses
- `ar_balance` من `accounts_receivable`, `ap_balance` من `accounts_payable`
- `inventory_value` من `aqh_finance_manual_balances.inventory_value` (أو حساب inventory إن وجد)
- `output_vat`, `deductible_input_vat` من `sales_invoices.vat_amount` و`purchase_invoices.deductible_vat_amount`
- `net_vat` = output − deductible

عند غياب COGS تعرض البطاقة "غير مكتمل — يحتاج ربط تكلفة المخزون" ولا يحسب مجمل الربح.

## 2. صفحة مقارنة الأشهر (`admin.finance.compare.tsx`)
تقسيم إلى قسمين:
- **مقارنة نقدية**: مقبوضات، مدفوعات، صافي تدفق، تحصيلات الحساب الشخصي، مدفوعات المالك (توسيع الجدول الحالي)
- **مقارنة محاسبية**: مبيعات، تكلفة مبيعات، مصروفات، صافي ربح، ضريبة مخرجات، ضريبة مدخلات (استدعاء `get_accounting_performance` لكل شهر)

## 3. قابلية التتبع (Drill-down)
كل بطاقة تفتح `FinanceRowsDrawer` أو Drawer جديد مماثل يعرض السجلات المصدر مع الفترة والفلاتر المطبقة. لا تفتح بطاقة بدون سجلات فعلية.

للبطاقات المحاسبية: Drawer جديد `AccountingRowsDrawer` يعرض القيود من `journal_entry_lines` مع رقم القيد والتاريخ والوصف والمبلغ.

## 4. التقارير (`admin.finance.reports.tsx`)
- إعادة تسمية التقرير الحالي إلى "تقرير المقبوضات والمدفوعات (نقدي)"
- إضافة تقرير جديد "قائمة الدخل" (Income Statement): صافي المبيعات، تكلفة المبيعات، مجمل الربح، المصروفات التشغيلية، صافي الربح — يعتمد على `get_accounting_performance`. سحوبات المالك مستثناة.

## تفاصيل تقنية

### Migration
```sql
CREATE OR REPLACE FUNCTION public.get_accounting_performance(p_from date, p_to date)
RETURNS TABLE(
  gross_sales numeric, sales_discounts numeric, net_sales numeric,
  cogs numeric, gross_profit numeric,
  operating_expenses numeric, net_profit numeric,
  ar_balance numeric, ap_balance numeric, inventory_value numeric,
  output_vat numeric, deductible_input_vat numeric, net_vat numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,private AS $$ ... $$;
-- REVOKE من public/anon، GRANT للأدوار المالية عبر has_any_finance_role
```
كل الأرقام `numeric(14,2)`.

### الملفات المعدلة/المنشأة
- **معدل**: `src/routes/_authenticated/admin.finance.index.tsx` (تبويبات)، `admin.finance.compare.tsx` (قسم محاسبي)، `admin.finance.reports.tsx` (تقرير قائمة الدخل)
- **جديد**: `src/lib/finance/accounting-performance.ts` (استدعاء RPC + أنواع)، `src/components/finance/AccountingRowsDrawer.tsx`
- **جديد**: migration واحدة لإنشاء RPC

### القيود على التنفيذ
- لا تعديل على الجداول أو الأعمدة الموجودة
- لا حذف بيانات
- لا بيانات تجريبية
- Grants: `REVOKE ALL FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated` (مع فحص الدور داخل الدالة)
- decimal دقيق (`numeric`)

## طريقة الاختبار
1. فتح `/admin/finance` — التبديل بين تبويب النقد والمحاسبي
2. اختيار شهر يحوي فواتير مبيعات معتمدة والتحقق من ظهور صافي المبيعات
3. حالة عدم توفر COGS → عرض رسالة "غير مكتمل"
4. الضغط على أي بطاقة → فتح Drawer بالسجلات
5. `/admin/finance/compare` → عرض قسمي المقارنة
6. `/admin/finance/reports` → توليد "قائمة الدخل" وتصديرها
7. التأكد أن سحوبات المالك لا تظهر ضمن مصروفات قائمة الدخل
