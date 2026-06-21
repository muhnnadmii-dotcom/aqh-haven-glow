export const ACCOUNT_TYPES = [
  { value: "business", label: "Business Account" },
  { value: "personal", label: "Personal Account" },
] as const;

export const INTERNAL_REVIEW = [
  { value: "unreviewed", label: "غير مراجع", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { value: "reviewed", label: "مراجع", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
] as const;

export const ACCOUNTANT_STATUS = [
  { value: "not_reviewed", label: "لم يراجع", tone: "bg-white/5 text-muted-foreground border-white/10" },
  { value: "reviewed", label: "تمت المراجعة", tone: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  { value: "posted_to_qoyod", label: "تم النقل إلى قيود", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { value: "needs_fix", label: "يحتاج تعديل", tone: "bg-red-500/15 text-red-300 border-red-500/30" },
] as const;

export const ATTACHMENT_STATUS = [
  { value: "attached", label: "مرفق", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { value: "not_attached", label: "غير مرفق", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { value: "not_required", label: "لا يحتاج مرفق", tone: "bg-white/5 text-muted-foreground border-white/10" },
] as const;

export const ATTACHMENT_TYPES = [
  "فاتورة", "صورة تحويل", "إيصال", "كشف حساب", "ملف تسوية", "أخرى",
];

export function labelOf<T extends readonly { value: string; label: string }[]>(
  arr: T,
  v: string | null | undefined,
): string {
  return arr.find((x) => x.value === v)?.label ?? "—";
}

export function toneOf<T extends readonly { value: string; tone: string }[]>(
  arr: T,
  v: string | null | undefined,
): string {
  return arr.find((x) => x.value === v)?.tone ?? "bg-white/5 text-muted-foreground border-white/10";
}

export function fmtSAR(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "0.00";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function monthOf(date: string): string {
  return date ? date.slice(0, 7) : "";
}
