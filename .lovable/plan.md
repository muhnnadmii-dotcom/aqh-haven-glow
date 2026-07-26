# محرك الترحيل المحاسبي — تقرير فحص + خطة تنفيذ

## 1) الملفات والدوال التي تُنشئ/ترحّل القيود

### مصدر القيود التلقائية اليوم (Triggers على الجداول التشغيلية)

| Trigger | Function | مصدر البيانات | Source type يُنتَج |
|---|---|---|---|
| `trg_auto_post_sales_invoice` (AFTER INS/UPD `sales_invoices`) | `public.auto_post_sales_invoice()` | اعتماد فاتورة مبيعات | `sales_invoice_approval` |
| `trg_auto_post_purchase_invoice` (AFTER INS/UPD `purchase_invoices`) | `public.auto_post_purchase_invoice()` | اعتماد فاتورة مشتريات | `purchase_invoice_approval` |
| `trg_auto_post_finance_income` (AFTER INS `finance_incomes`) | `public.auto_post_finance_income()` | تحصيلات نقدية/بنكية | `sales_invoice_collection` / `owner_contribution` |
| `trg_auto_post_finance_expense` (AFTER INS `finance_expenses`) | `public.auto_post_finance_expense()` (آخر نسخة: `20260715000145`) | دفع مورد / تعويض مالك / سحب مالك / تحويل داخلي صادر | `purchase_invoice_payment` / `owner_withdrawal` / `internal_transfer` |
| — (لا trigger؛ يُستدعى يدويًا) | `public.build_gateway_journal_drafts(...)` `20260714212025` | تحصيلات سلة/تابي/تمارا + وصول التسويات للبنك | `sales_invoice_collection` (مسودة) + `payment_settlement_payout` (مسودة) |
| RPC | `public.confirm_provider_invoice_payment(...)` `20260725005816` | سداد فاتورة مشتريات من محفظة البوابة | `purchase_invoice_payment` |
| RPC | `public.reverse_provider_invoice_payment(...)` `20260716205848` | إلغاء دفعة بوابة | يعكس القيد |
| Helper مركزي | `public.post_journal_entry(date,text,journal_source_type,text,jsonb)` `20260711180515` | أداة إدراج قيد ملزَم بالتوازن | كل الأنواع |

### حوكمة القيود
- `public.acct_should_post(date)` — بوّابة زمنية عامّة (تعتمد `accounting_settings.accounting_start_date` و`auto_post_enabled`).
- `journal_entries_before_insert` — يرقّم القيد.
- `journal_entries_guard` — يمنع التعديل بعد الترحيل.
- `journal_entries_check_balance` — يفرض التوازن.
- **مفتاح تفرّد**: `uniq_je_source_active(source_type, source_id) WHERE source_type<>'manual' AND status<>'reversed'` — يمنع تكرار القيد لنفس المصدر.
- Enum `journal_source_type` يشمل: manual / sales_invoice_approval / sales_invoice_collection / owner_reimbursement / purchase_invoice_approval / purchase_invoice_payment / owner_contribution / owner_withdrawal / internal_transfer / payment_settlement_payout.

### واجهات المستخدم الحالية
- `src/routes/_authenticated/admin.finance.journal-entries.tsx` — قائمة القيود + إنشاء يدوي + قيد عكسي.
- `src/routes/_authenticated/admin.finance.trial-balance.tsx` / `.general-ledger.tsx` / `.reports.tsx` — قراءة فقط من القيود المرحّلة.
- `src/components/finance/AccountingPanel.tsx` و`AccountingRowsDrawer.tsx` — عرض القيد على مستوى الحساب/الفترة.

## 2) شرط التاريخ المؤثّر في دفعات المصروفات

**ليس 2026-04-01 كما ورد في الطلب — الشرط الفعلي هو `2026-07-01`.**
الموقع الوحيد داخل `public.auto_post_finance_expense()` النسخة الفعّالة `supabase/migrations/20260715000145_...sql:104`:
```
IF v_je IS NOT NULL AND NEW.expense_date < DATE '2026-07-01' THEN
  UPDATE public.journal_entries SET status = 'posted' WHERE id = v_je;
END IF;
```
- التاريخ **مضمّن نصًّا (hard-coded)**، ليس قيمة إعدادات.
- يُطبَّق **فقط لحظة إنشاء المصروف**؛ أي مصروف أُدخل قبل تفعيل هذا التحديث بقي مسودة (يفسّر وجود 19 قيد `purchase_invoice_payment` مسودة بتواريخ من 2026-04-04 حتى 2026-07-20 كلها أُنشئت بين 2026-07-15 و2026-07-25).
- لا يُعاد تقييم الحالة عند تعديل المصروف لاحقًا.

## 3) الأرقام الثابتة (safety amounts)

الملف الوحيد: `supabase/migrations/20260714212025_861a1fe2-a152-4fe0-9757-0f79b516b645.sql` (والنسخة الأقدم `20260714211922`) داخل توقيع `build_gateway_journal_drafts(...)`:
- `p_expected_collection_count int DEFAULT 800`
- `p_expected_collection_total numeric DEFAULT 258327.74`
- `p_expected_payout_count int DEFAULT 75`
- `p_expected_payout_total numeric DEFAULT 278352.96`
تُستخدم كـ safety guard: تُرفع الاستثناء `safety mismatch` إذا اختلف الحقيقي عن المتوقّع. لا ثوابت مماثلة أخرى في الكود.

## 4) مخطط الجداول ذات العلاقة

- **القيود**: `journal_entries(id, entry_number UNIQUE, entry_date, source_type journal_source_type, source_id text, status draft/posted/reversed, period_id, reversal_entry_id, reversed_by_entry_id, total_debit, total_credit, posted_by, posted_at)` — فهرس فريد `uniq_je_source_active`.
- **بنود القيود**: `journal_entry_lines(journal_entry_id, account_id, debit, credit, customer_id, supplier_id, finance_account_id, owner_settlement_reference, line_order)` — قيود CHECK على الأرقام والتوازن.
- **دليل الحسابات**: `chart_of_accounts(code UNIQUE, system_key, account_type, is_active)` — يُلتقط بواسطة `acct_id(system_key)`.
- **الفترات**: `accounting_periods` + `accounting_settings` + `ensure_accounting_period(date)`.
- **المشتريات**: `purchase_invoices(status, total_amount, supplier_id, issue_date, internal_reference)` + `purchase_invoice_items` + `purchase_invoice_provider_payments` (سداد من محفظة البوابة).
- **المبيعات**: `sales_invoices(status, total_amount, customer_id, issue_date, payment_provider)` + `sales_invoice_items`.
- **دخل/مصروف تشغيلي**: `finance_incomes(income_date, amount, account_id, deleted_at)` و`finance_expenses(expense_date, amount, purchase_invoice_id, transaction_type, business_relation, account_id, account_type, supplier_id, deleted_at)`.
- **التسويات**: `payment_settlements` + `payment_settlement_lines(line_type sale/refund/partial_refund/fee/...)` + `settlement_bank_allocations(status confirmed, allocated_amount, transaction_id→finance_incomes)`.
- **الحسابات المالية**: `finance_accounts(account_owner_type company/owner, ...)` + `payment_providers(provider_code, clearing_account_id)`.
- **التدقيق**: `finance_audit_logs`.
- **منع التكرار**: `uniq_je_source_active` + فحوصات صريحة `NOT EXISTS` داخل كل triggerو RPC.

## 5) لماذا صارت 905 قيد مسودة؟

توزيع فعلي (استعلام مباشر):

| Source | Count | Range تاريخ العملية | تاريخ الإنشاء |
|---|---:|---|---|
| sales_invoice_collection | 800 | 2026-01-01 → 2026-07-14 | كلها 2026-07-14 |
| payment_settlement_payout | 75 | 2026-01-07 → 2026-06-30 | كلها 2026-07-14 |
| purchase_invoice_payment | 19 | 2026-04-04 → 2026-07-20 | 2026-07-15 → 2026-07-25 |
| internal_transfer | 10 | 2026-04-05 → 2026-06-24 | كلها 2026-07-17 |
| owner_withdrawal | 1 | 2026-07-09 | 2026-07-16 |

- **800 + 75** = مخرجات `build_gateway_journal_drafts` (شغّلها المستخدم في 2026-07-14). هذه مسودات **اقتراحية تاريخية** يجب مراجعتها؛ تحمل نصّ "مسودة تاريخية" في الوصف. آمنة للاعتماد بعد المطابقة.
- **19 purchase_invoice_payment + 10 internal_transfer + 1 owner_withdrawal** = ناتج trigger `auto_post_finance_expense`. رغم أن معظمها < 2026-07-01، ظلّت مسودة لأن شرط `< '2026-07-01'` يُطبَّق فقط لحظة إنشاء صف `finance_expenses`؛ هذه الصفوف أُنشئت (أو أُعيد التعامل معها) بعد أن كان الترقيّة معطّلة أو قبل تحديث المنطق.

**كلها قيود متوازنة ومكتملة تقنيًا** (تمرّ عبر `journal_entries_check_balance`) — الفارق سياسي: تحتاج مراجعة يدوية قبل الترحيل.

## 6) بناء محرك معاينة idempotent

نعم، ممكن ومطلوب. يعتمد على الآتي:
- كل مصدر عملية له مفتاح مستقر: `sales_invoices.id`, `purchase_invoices.id`, `settlement_bank_allocations.id`, `finance_expenses.id` (لـ payment/transfer/withdrawal).
- `uniq_je_source_active` يعطي مقارنة "1:1" مباشرة بين العملية والقيد الحالي (إن وُجد).
- يمكن بناء view/RPC `finance_posting_plan(from_date, to_date)` يُصنّف كل عملية:
  - **correct** — يوجد قيد نشط ومطابق (نفس التاريخ، نفس المجموع، نفس الحسابات).
  - **missing** — عملية معتمدة بلا قيد.
  - **draft_pending** — يوجد قيد لكنه draft (يشمل الـ905).
  - **mismatch** — يوجد قيد بمبلغ/تاريخ/حساب مختلف عن القيد المقترح.
  - **duplicate** — أكثر من قيد نشط (نظريًا محجوب بالفهرس لكن يُفحص لعمليات manual القديمة).
- المخرج يعرض جنبًا إلى جنب: القيد الحالي (إن وُجد) والقيد المقترح (سطور Dr/Cr كاملة) قبل أي زر اعتماد.

## 7) مخاطر RLS/الصلاحيات/التدقيق عند إضافة واجهة اعتماد يدوي

- سياسات `journal_entries` الحالية تسمح UPDATE/INSERT لأي `admin/finance_manage/finance_accountant` — الاعتماد اليدوي يحتاج **RPC مقيّد** يفصل صلاحية "اعتماد" عن "تعديل"، ويكتب `posted_by` و`posted_at` من داخل الدالة.
- DELETE محصور على drafts فقط عبر `je_delete_draft` — جيد؛ لا يجب لمسه.
- كل عملية اعتماد/رفض يجب أن تُسجَّل في `finance_audit_logs` مع `entity='journal_entries'`, `action='approve'|'reject'|'preview_run'`, ومَن نفّذها.
- المعاينة يجب أن تكون `SECURITY DEFINER` مع فحص دور صريح داخل الدالة (كما في `build_gateway_journal_drafts`) وتُمنع من anon.
- لا تُعدَّل قيود مصدرها `manual`؛ تُعرض للمراجعة فقط.
- الحفاظ على `uniq_je_source_active` عند أي إدراج جديد من واجهة الاعتماد.

## 8) خطة تنفيذ مرحلية — المرحلة 1 قراءة فقط

القرارات المعتمدة (بنية الحسابات، مراجعة 2026 كامل، عدم لمس Q2 بمبلغ 13,847.36، عدم إعادة بناء ما قبل 2026-07-01 من مدفوعات شخصية، لا حذف/ترحيل الآن) مدمجة في التصنيف والمعاينة فقط.

### المرحلة 1 — قراءة/معاينة فقط (هذه المرحلة)
Migration واحدة (قراءة فقط، لا تلمس القيود ولا العمليات):
1. `public.finance_posting_scan(p_from date, p_to date)` — RPC `SECURITY DEFINER`, `STABLE`, يعيد جدولًا لكل عملية معتمدة بين التاريخين:
   - `op_kind` (sales_collection / provider_payout / purchase_payment / internal_transfer / owner_withdrawal / sales_approval / purchase_approval)
   - `op_id`, `op_date`, `op_amount`, `counterparty_id`, `provider_code`
   - `expected_lines jsonb` (Dr/Cr المقترحة حسب دليل الحسابات ومصادر البيانات)
   - `existing_je_id`, `existing_je_status`, `existing_lines jsonb`
   - `classification` (correct/draft_pending/missing/mismatch/duplicate/out_of_scope)
   - `diff_reason text`
2. `public.finance_posting_summary(p_from, p_to)` — يجمّع الأعداد والمبالغ لكل `classification × op_kind`.
3. RLS/GRANT: EXECUTE للأدوار `admin/finance_manage/finance_accountant` فقط.
4. صفحة UI جديدة: `src/routes/_authenticated/admin.finance.posting-review.tsx` — RTL، تعرض:
   - KPIs (correct / draft_pending / missing / mismatch).
   - فلاتر: الفترة (افتراضيًا 2026-01-01 → اليوم)، op_kind، classification، الحساب/الجهة.
   - جدول عمليات مع Drawer يعرض القيد الحالي مقابل المقترح.
   - أزرار الاعتماد **معطّلة** ومختومة "المرحلة 2".
   - رابط من صفحة `admin.finance.journal-entries.tsx` وقائمة الجانب في `admin.finance.tsx`.
5. اختبارات (`tests/`): سيناريو قراءة يستدعي `finance_posting_scan` ويثبت أن العدد الإجمالي للفئات = عدد العمليات في الفترة، وأن الـ905 مسودة الحالية تظهر كـ `draft_pending`.

**غير مسموح في هذه المرحلة**: أي `UPDATE`/`INSERT`/`DELETE` على `journal_entries` أو `finance_expenses` أو `finance_incomes`، ولا تعديل triggers، ولا نشر.

### المرحلة 2 — اعتماد يدوي مضبوط (لاحقًا، بعد موافقة)
- RPC `finance_posting_approve(p_op_kind, p_op_id, p_confirm_hash)` يرحّل القيد الموجود إذا كان `draft_pending` ومطابقًا للمقترح، أو ينشئ قيدًا جديدًا للحالات `missing`.
- RPC `finance_posting_reject(...)` للتخطي مع سبب.
- تسجيل كامل في `finance_audit_logs` مع hash المقترح المعتمَد.
- عزل الحسابات الشخصية عبر `is_personal_account` في finance_accounts (استغلال ما هو موجود).
- تفعيل مسار "مدفوع شخصيًا من 2026-07-01" ⇒ استحقاق للمالك عبر `due_to_owner` (كما هو الآن)، مع رفض الاقتراح آليًا للمعاملات الشخصية قبل 2026-07-01.

### المرحلة 3 — تصحيحات التصنيف والقيود التاريخية (لاحقًا)
- استبدال شرط `< '2026-07-01'` النصّي بحقل `accounting_settings.manual_review_from date` قابل للتحكم.
- إلغاء الأرقام الثابتة داخل `build_gateway_journal_drafts` واستبدالها بـ`safety_hash` يُحسَب لحظيًا ويُقارَن بقيمة محفوظة يوقّعها المستخدم.
- ترقية سطور تابي/تمارا: قيد رسوم آلي عند وجود فاتورة رسوم متطابقة.
- Q2 يبقى مقفلًا (period=locked) — لن يظهر في نطاق الفحص الافتراضي.

### الملفات المتوقّع لمسها في المرحلة 1
- Migration جديدة واحدة: `supabase/migrations/<ts>_finance_posting_scan.sql` (قراءة فقط، دوال + GRANTs).
- `src/routes/_authenticated/admin.finance.posting-review.tsx` (جديد).
- تعديل صغير في `src/routes/_authenticated/admin.finance.tsx` (رابط قائمة).
- تعديل صغير في `src/lib/admin-pages.ts` (تسجيل الصفحة والصلاحية).
- اختبار قراءة في `tests/`.

### تحقّق نهائي
- استعلامات مقارنة قبل/بعد المرحلة 1: عدد القيود لكل status × source_type ثابت (0 تغيير).
- تشغيل `finance_posting_scan('2026-01-01', current_date)` وطباعة الملخّص لمراجعة الأرقام مع المستخدم قبل أي اعتماد.
