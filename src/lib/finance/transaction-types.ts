// Transaction type classification for finance incomes and expenses.
// Values match Postgres enums: finance_incoming_type, finance_outgoing_type,
// finance_accounting_status.
//
// Old values are kept for backward compatibility with existing rows.
// New values (2026) reflect the standardized taxonomy.

export type IncomingType =
  // New standardized values
  | "customer_invoice_collection"
  | "direct_sale"
  | "customer_advance"
  | "payment_provider_settlement"
  | "supplier_refund"
  | "owner_contribution"
  | "owner_collection"
  | "internal_transfer_in"
  | "loan_received"
  | "other_incoming"
  | "unclassified_incoming"
  // Legacy values retained for old rows
  | "cash_sale"
  | "other_income";

export type OutgoingType =
  // New standardized values
  | "supplier_invoice_payment"
  | "direct_operating_expense"
  | "inventory_purchase"
  | "asset_purchase"
  | "salary_payment"
  | "government_fee"
  | "customer_refund"
  | "owner_reimbursement"
  | "owner_withdrawal"
  | "internal_transfer_out"
  | "loan_payment"
  | "other_outgoing"
  | "unclassified_outgoing"
  // Legacy values retained for old rows
  | "operating_expense"
  | "tax_or_government_payment";

export type AccountingStatus = "unclassified" | "classified" | "reviewed";

export type BusinessRelation =
  | "business"
  | "personal"
  | "owner_settlement"
  | "internal_transfer"
  | "unclassified";

/** Ordered list shown in the incoming type dropdown (new taxonomy only). */
export const INCOMING_TYPES: { value: IncomingType; label: string }[] = [
  { value: "customer_invoice_collection", label: "تحصيل فاتورة عميل" },
  { value: "direct_sale", label: "مبيعات مباشرة" },
  { value: "customer_advance", label: "دفعة مقدمة من عميل" },
  { value: "payment_provider_settlement", label: "تحويل تسوية وسيط دفع" },
  { value: "supplier_refund", label: "استرداد من مورد" },
  { value: "owner_contribution", label: "مساهمة مالك" },
  { value: "owner_collection", label: "تحصيل نشاط في حساب شخصي" },
  { value: "internal_transfer_in", label: "تحويل داخلي وارد" },
  { value: "loan_received", label: "قرض أو تمويل" },
  { value: "other_incoming", label: "وارد آخر" },
  { value: "unclassified_incoming", label: "غير مصنف" },
];

/** Ordered list shown in the outgoing type dropdown (new taxonomy only). */
export const OUTGOING_TYPES: { value: OutgoingType; label: string }[] = [
  { value: "supplier_invoice_payment", label: "دفع فاتورة مورد" },
  { value: "direct_operating_expense", label: "مصروف تشغيلي مباشر" },
  { value: "inventory_purchase", label: "شراء مخزون" },
  { value: "asset_purchase", label: "شراء أصل" },
  { value: "salary_payment", label: "راتب أو مستحق موظف" },
  { value: "government_fee", label: "رسوم حكومية" },
  { value: "customer_refund", label: "استرداد لعميل" },
  { value: "owner_reimbursement", label: "تعويض مالك" },
  { value: "owner_withdrawal", label: "سحب مالك" },
  { value: "internal_transfer_out", label: "تحويل داخلي صادر" },
  { value: "loan_payment", label: "سداد قرض" },
  { value: "other_outgoing", label: "صادر آخر" },
  { value: "unclassified_outgoing", label: "غير مصنف" },
];

/** Legacy labels — used only to display old rows correctly. */
const LEGACY_INCOMING_LABELS: Record<string, string> = {
  cash_sale: "مبيعات نقدية (قديم)",
  other_income: "إيراد آخر (قديم)",
};
const LEGACY_OUTGOING_LABELS: Record<string, string> = {
  operating_expense: "مصروف تشغيلي (قديم)",
  tax_or_government_payment: "ضريبة/رسوم حكومية (قديم)",
};

export const ACCOUNTING_STATUSES: { value: AccountingStatus; label: string }[] = [
  { value: "unclassified", label: "غير مصنف" },
  { value: "classified", label: "مصنف" },
  { value: "reviewed", label: "تمت مراجعته" },
];

export function incomingLabel(v?: string | null): string {
  if (!v) return "—";
  return (
    INCOMING_TYPES.find((t) => t.value === v)?.label ??
    LEGACY_INCOMING_LABELS[v] ??
    v
  );
}
export function outgoingLabel(v?: string | null): string {
  if (!v) return "—";
  return (
    OUTGOING_TYPES.find((t) => t.value === v)?.label ??
    LEGACY_OUTGOING_LABELS[v] ??
    v
  );
}
export function accountingStatusLabel(v?: string | null): string {
  return ACCOUNTING_STATUSES.find((t) => t.value === v)?.label ?? "غير مصنف";
}

/**
 * Incoming types EXCLUDED from operating "المقبوضات".
 * NULL stays operating (legacy rows are not reclassified automatically).
 */
export const NON_OPERATING_INCOMING: ReadonlySet<string> = new Set([
  "owner_contribution",
  "internal_transfer_in",
  "loan_received",
  "payment_provider_settlement", // settlement transfer, not a new sale
]);

/**
 * Outgoing types EXCLUDED from operating "المدفوعات".
 * NULL stays operating (legacy rows are not reclassified automatically).
 */
export const NON_OPERATING_OUTGOING: ReadonlySet<string> = new Set([
  "owner_withdrawal",
  "owner_reimbursement", // reimbursing owner's cash — not a new expense
  "internal_transfer_out",
  "loan_payment",
]);

export function isOperatingIncome(row: { transaction_type?: string | null }): boolean {
  const t = row.transaction_type;
  if (!t) return true;
  return !NON_OPERATING_INCOMING.has(t);
}

export function isOperatingExpense(
  row: { transaction_type?: string | null; main_category_id?: string | null },
  ownerDrawCatId: string | null,
): boolean {
  if (ownerDrawCatId && row.main_category_id === ownerDrawCatId) return false;
  const t = row.transaction_type;
  if (!t) return true;
  return !NON_OPERATING_OUTGOING.has(t);
}

export function isOwnerDraw(
  row: { transaction_type?: string | null; main_category_id?: string | null },
  ownerDrawCatId: string | null,
): boolean {
  if (row.transaction_type === "owner_withdrawal") return true;
  if (ownerDrawCatId && row.main_category_id === ownerDrawCatId) return true;
  return false;
}

/**
 * Derive the default business_relation from a transaction type.
 * Used to auto-set the field when the user picks a type; the user can
 * still override afterwards. Returns null when the type does not imply
 * a specific relation.
 */
export function defaultBusinessRelation(
  t?: string | null,
): BusinessRelation | null {
  if (!t) return null;
  switch (t) {
    case "internal_transfer_in":
    case "internal_transfer_out":
      return "internal_transfer";
    case "owner_contribution":
    case "owner_withdrawal":
    case "owner_reimbursement":
    case "owner_collection":
      return "owner_settlement";
    case "customer_invoice_collection":
    case "direct_sale":
    case "customer_advance":
    case "payment_provider_settlement":
    case "supplier_refund":
    case "supplier_invoice_payment":
    case "direct_operating_expense":
    case "inventory_purchase":
    case "asset_purchase":
    case "salary_payment":
    case "government_fee":
    case "customer_refund":
    case "loan_received":
    case "loan_payment":
    case "other_incoming":
    case "other_outgoing":
      return "business";
    default:
      return null;
  }
}
