## الهدف
إضافة تصنيف واضح لكل حركة مالية (وارد/صادر + نوع الحركة + حالة التصنيف) على الجداول الحالية `finance_incomes` و `finance_expenses`، بدون حذف بيانات أو إعادة بناء.

## 1) Migration آمنة (إضافة أعمدة + Enums)

إنشاء نوعين جديدين واستخدامهما على الجدولين الحاليين:

- `finance_transaction_direction`: `incoming | outgoing`
- `finance_incoming_type`: 8 قيم (customer_invoice_collection, cash_sale, owner_contribution, internal_transfer_in, supplier_refund, loan_received, other_income, unclassified_incoming)
- `finance_outgoing_type`: 10 قيم (supplier_invoice_payment, operating_expense, inventory_purchase, asset_purchase, owner_withdrawal, internal_transfer_out, loan_payment, tax_or_government_payment, customer_refund, unclassified_outgoing)
- `finance_accounting_status`: `unclassified | classified | reviewed`

الأعمدة المضافة على كل من `finance_incomes` و `finance_expenses`:

| الحقل | النوع | ملاحظات |
|---|---|---|
| `transaction_direction` | enum | ثابت: incoming للمقبوضات، outgoing للمدفوعات (default حسب الجدول) |
| `transaction_type` | enum مناسب للاتجاه | nullable في البداية |
| `accounting_status` | enum | default `unclassified` |
| `related_transaction_id` | uuid | nullable (للتحويلات الداخلية المتقابلة) |
| `internal_note` | text | nullable |

- البيانات القديمة تبقى كما هي: `transaction_type = NULL`، `accounting_status = 'unclassified'`.
- لا يوجد تحويل تلقائي بناءً على اسم أو وصف — لا نلمس المبالغ أو التواريخ.
- (اختياري وآمن) للسجلات التي مصدرها فئة "توزيع الأرباح/سحوبات المالك" الحالية بشكل قاطع فقط، تُضبط `transaction_type = 'owner_withdrawal'` و `accounting_status = 'classified'` — بشرط وجود slug واضح مثل `owner_draw` في `finance_categories.system_slug`. غير ذلك تبقى unclassified.

## 2) تعديل الواجهة (بدون تغيير التصميم)

**نموذج المقبوضات** (`admin.finance.incomes.tsx`):
- إضافة `Select` لـ "نوع الحركة" بقيم incoming (مع تسميات عربية).
- عرض العمود في الجدول.
- فلتر علوي: نوع الحركة + حالة التصنيف (الكل/غير مصنف/مصنف/تمت مراجعته).
- بطاقة صغيرة أعلى الصفحة "حركات غير مصنفة: N" — الضغط عليها يفعّل فلتر unclassified.

**نموذج المدفوعات** (`admin.finance.expenses.tsx`):
- نفس الإضافات مع قيم outgoing.

عند اختيار نوع الحركة يدويًا تنتقل `accounting_status` تلقائيًا إلى `classified`.

## 3) منطق التقارير

تحديث فلاتر الجمع في:
- `admin.finance.index.tsx` (KPIs + توزيع الأرباح + النقد المباشر)
- `admin.finance.compare.tsx`
- `admin.finance.reports.tsx`
- `computeLiveCash` في حساب النقد المرتبط بالـ anchor

قواعد الاستبعاد من إجمالي التشغيل (مقبوضات ومدفوعات):
- استبعاد `internal_transfer_in` / `internal_transfer_out`
- استبعاد `owner_contribution` من المقبوضات
- استبعاد `owner_withdrawal` من المدفوعات (تبقى ضمن "سحوبات المالك")
- استبعاد `loan_received` من المقبوضات
- استبعاد `loan_payment` من المدفوعات

ملاحظة: الحركات القديمة `transaction_type = NULL` تبقى ضمن التشغيل كما هي اليوم (حفاظًا على الأرقام الحالية).

سحوبات المالك (Owner Draws) في الداشبورد: يعتمد الآن على `transaction_type = 'owner_withdrawal'` بالإضافة إلى المصدر الحالي (فئة "توزيع الأرباح") — أيهما أوجد.

النقد المباشر (`cash_anchor_date`) يستمر بجمع كل الحركات بعد تاريخ الإرساء، لأن التحويلات الداخلية تؤثر فعلاً على الرصيد النقدي؛ لكن سنستثني `internal_transfer_*` لأنها متعادلة (in/out) لتفادي الازدواج عندما يتم ربطها عبر `related_transaction_id`. الحركات القديمة غير المتأثرة تبقى كما هي.

## 4) الملفات المتوقع تعديلها
- Migration واحدة (Enums + ALTER TABLE + defaults).
- `src/routes/_authenticated/admin.finance.incomes.tsx`
- `src/routes/_authenticated/admin.finance.expenses.tsx`
- `src/routes/_authenticated/admin.finance.index.tsx`
- `src/routes/_authenticated/admin.finance.compare.tsx`
- `src/routes/_authenticated/admin.finance.reports.tsx`
- ملف مساعد جديد `src/lib/finance-transaction-types.ts` (قوائم الأنواع + التسميات العربية + مجموعات الاستبعاد).

## معايير القبول
- Enums وأعمدة جديدة موجودة على الجدولين.
- بيانات قديمة سليمة تمامًا (لا تغيير للمبالغ/التواريخ) و `accounting_status = unclassified`.
- إمكانية إضافة/تعديل حركة مع اختيار نوعها ورؤية عمودها وفلترتها.
- بطاقة "غير مصنف" تعمل كفلتر سريع.
- التحويلات الداخلية وسحوبات المالك ومساهمات المالك والقروض مستثناة من إجمالي التشغيل في KPIs والتقارير.
- لا أخطاء TypeScript ولا انكسار في السياسات/الصلاحيات (الأعمدة الجديدة تحت نفس RLS الحالية).
