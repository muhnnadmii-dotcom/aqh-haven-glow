export const PURCHASE_TYPE_LABEL: Record<string, string> = {
  operating_expense: "مصروف تشغيلي",
  inventory: "مخزون",
  asset: "أصل ثابت",
  service: "خدمة",
  government_fee: "رسوم حكومية",
  other: "أخرى",
};

export const PURCHASE_STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  under_review: "قيد المراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  partially_paid: "مدفوعة جزئيًا",
  paid: "مدفوعة",
};

export const PURCHASE_STATUS_CLASS: Record<string, string> = {
  draft: "bg-white/10 text-muted-foreground border-white/20",
  under_review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  partially_paid: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export const PURCHASE_PAY_LABEL: Record<string, string> = {
  unpaid: "غير مدفوعة",
  partially_paid: "جزئي",
  paid: "مدفوعة",
  overpaid: "زائد",
};

export const VAT_DEDUCTIBILITY_LABEL: Record<string, string> = {
  fully_deductible: "قابل للخصم بالكامل",
  partially_deductible: "قابل للخصم جزئيًا",
  non_deductible: "غير قابل للخصم",
  pending_review: "قيد المراجعة",
};

export const NON_DEDUCTIBLE_REASON_LABEL: Record<string, string> = {
  missing_tax_invoice: "لا توجد فاتورة ضريبية",
  invalid_supplier_tax_data: "بيانات ضريبية غير صحيحة للمورد",
  personal_expense: "مصروف شخصي",
  unrelated_to_business: "غير مرتبط بالنشاط",
  exempt_activity: "نشاط معفى",
  duplicate_invoice: "فاتورة مكررة",
  outside_tax_period: "خارج الفترة الضريبية",
  restricted_expense: "مصروف مقيّد",
  other: "أخرى",
};

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  supplier_invoice_payment: "دفعة فاتورة مورد",
  direct_expense: "مصروف مباشر",
  inventory_payment: "دفعة مخزون",
  asset_payment: "دفعة أصل",
  owner_reimbursement: "تعويض مالك",
  other: "أخرى",
};

export const ATTACHMENT_LABEL: Record<string, string> = {
  attached: "مرفق",
  not_attached: "غير مرفق",
  not_required: "مستثنى",
};

export const SAR = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(n) || 0);
