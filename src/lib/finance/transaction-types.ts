// Transaction type classification for finance incomes and expenses.
// Values match Postgres enums: finance_incoming_type, finance_outgoing_type,
// finance_accounting_status.

export type IncomingType =
  | "customer_invoice_collection"
  | "cash_sale"
  | "owner_contribution"
  | "internal_transfer_in"
  | "supplier_refund"
  | "loan_received"
  | "other_income"
  | "unclassified_incoming";

export type OutgoingType =
  | "supplier_invoice_payment"
  | "operating_expense"
  | "inventory_purchase"
  | "asset_purchase"
  | "owner_withdrawal"
  | "internal_transfer_out"
  | "loan_payment"
  | "tax_or_government_payment"
  | "customer_refund"
  | "unclassified_outgoing";

export type AccountingStatus = "unclassified" | "classified" | "reviewed";

export const INCOMING_TYPES: { value: IncomingType; label: string }[] = [
  { value: "customer_invoice_collection", label: "تحصيل فاتورة عميل" },
  { value: "cash_sale", label: "مبيعات نقدية" },
  { value: "owner_contribution", label: "إيداع/مساهمة مالك" },
  { value: "internal_transfer_in", label: "تحويل داخلي وارد" },
  { value: "supplier_refund", label: "استرداد من مورد" },
  { value: "loan_received", label: "قرض أو تمويل مستلم" },
  { value: "other_income", label: "إيراد آخر" },
  { value: "unclassified_incoming", label: "وارد غير مصنف" },
];

export const OUTGOING_TYPES: { value: OutgoingType; label: string }[] = [
  { value: "supplier_invoice_payment", label: "دفع فاتورة مورد" },
  { value: "operating_expense", label: "مصروف تشغيلي" },
  { value: "inventory_purchase", label: "شراء مخزون" },
  { value: "asset_purchase", label: "شراء أصل" },
  { value: "owner_withdrawal", label: "سحب مالك" },
  { value: "internal_transfer_out", label: "تحويل داخلي صادر" },
  { value: "loan_payment", label: "سداد قرض/تمويل" },
  { value: "tax_or_government_payment", label: "ضريبة أو رسوم حكومية" },
  { value: "customer_refund", label: "استرداد مبلغ لعميل" },
  { value: "unclassified_outgoing", label: "صادر غير مصنف" },
];

export const ACCOUNTING_STATUSES: { value: AccountingStatus; label: string }[] = [
  { value: "unclassified", label: "غير مصنف" },
  { value: "classified", label: "مصنف" },
  { value: "reviewed", label: "تمت مراجعته" },
];

export function incomingLabel(v?: string | null): string {
  return INCOMING_TYPES.find((t) => t.value === v)?.label ?? "—";
}
export function outgoingLabel(v?: string | null): string {
  return OUTGOING_TYPES.find((t) => t.value === v)?.label ?? "—";
}
export function accountingStatusLabel(v?: string | null): string {
  return ACCOUNTING_STATUSES.find((t) => t.value === v)?.label ?? "غير مصنف";
}

/** Incoming types EXCLUDED from operating "المقبوضات". NULL stays operating. */
export const NON_OPERATING_INCOMING: ReadonlySet<IncomingType> = new Set([
  "owner_contribution",
  "internal_transfer_in",
  "loan_received",
]);

/** Outgoing types EXCLUDED from operating "المدفوعات". NULL stays operating. */
export const NON_OPERATING_OUTGOING: ReadonlySet<OutgoingType> = new Set([
  "owner_withdrawal",
  "internal_transfer_out",
  "loan_payment",
]);

export function isOperatingIncome(row: { transaction_type?: string | null }): boolean {
  const t = row.transaction_type as IncomingType | null | undefined;
  if (!t) return true;
  return !NON_OPERATING_INCOMING.has(t);
}

export function isOperatingExpense(row: { transaction_type?: string | null; main_category_id?: string | null }, ownerDrawCatId: string | null): boolean {
  if (ownerDrawCatId && row.main_category_id === ownerDrawCatId) return false;
  const t = row.transaction_type as OutgoingType | null | undefined;
  if (!t) return true;
  return !NON_OPERATING_OUTGOING.has(t);
}

export function isOwnerDraw(row: { transaction_type?: string | null; main_category_id?: string | null }, ownerDrawCatId: string | null): boolean {
  if (row.transaction_type === "owner_withdrawal") return true;
  if (ownerDrawCatId && row.main_category_id === ownerDrawCatId) return true;
  return false;
}
