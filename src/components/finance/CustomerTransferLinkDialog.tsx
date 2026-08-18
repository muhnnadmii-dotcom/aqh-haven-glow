import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, X, Loader2 } from "lucide-react";
import { fmtSAR } from "@/lib/finance/constants";
import {
  fetchSuggestions,
  linkIncomeToInvoice,
  TRANSFER_LABELS,
  TRANSFER_TONES,
  type Suggestion,
  type TransferStatusRow,
} from "@/lib/finance/customer-transfers";

/**
 * Suggests up to 3 Salla invoices for a direct customer transfer.
 * Never links automatically — the user must confirm one suggestion.
 */
export function CustomerTransferLinkDialog({
  income,
  status,
  onClose,
  onLinked,
}: {
  income: any;
  status: TransferStatusRow | undefined;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await fetchSuggestions(income.id);
        if (alive) setItems(s);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "تعذر جلب الاقتراحات");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [income.id]);

  const doLink = async (invoiceId: number) => {
    if (!confirm("ربط هذه الحوالة بالفاتورة المحددة؟ لن يتم إنشاء مقبوض جديد ولا تكرار للقيد.")) return;
    setBusy(invoiceId);
    try {
      await linkIncomeToInvoice(income.id, invoiceId);
      toast.success("تم ربط الحوالة بالفاتورة");
      onLinked();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الربط");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" dir="rtl">
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-background p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Link2 size={15} /> ربط الحوالة بفاتورة
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={15} />
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-[12px] space-y-1">
          <div>
            التاريخ: <span className="font-mono">{income.income_date}</span> — المبلغ:{" "}
            <span className="font-mono text-gold">{fmtSAR(income.amount)}</span>
          </div>
          {income.note && <div className="text-muted-foreground">{income.note}</div>}
          {status && (
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${TRANSFER_TONES[status.link_state]}`}>
              {TRANSFER_LABELS[status.link_state]}
            </span>
          )}
        </div>

        <div className="mt-4 text-[11px] text-muted-foreground">
          أفضل 3 اقتراحات حسب: الجوال ثم الاسم ثم المبلغ ثم قرب التاريخ. لا يتم الربط تلقائيًا.
        </div>

        {loading ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground inline-flex items-center gap-2 w-full justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري البحث…
          </div>
        ) : err ? (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-300">{err}</div>
        ) : items.length === 0 ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4 text-[12px] text-muted-foreground">
            لا توجد فواتير سلة مرشحة للربط — راجع الفاتورة يدويًا.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((s) => (
              <div key={s.invoice_id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold">
                    فاتورة {s.invoice_number ?? `#${s.invoice_id}`} — {s.customer_name ?? "بدون اسم"}
                  </div>
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${
                      s.confidence === "عالية"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : s.confidence === "متوسطة"
                          ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                          : "bg-white/5 text-muted-foreground border-white/15"
                    }`}
                  >
                    ثقة {s.confidence} ({s.score})
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                  <div>التاريخ: <span className="font-mono text-foreground">{s.issue_date}</span></div>
                  <div>الإجمالي: <span className="font-mono text-foreground">{fmtSAR(s.total_amount)}</span></div>
                  <div>المتبقي: <span className="font-mono text-foreground">{fmtSAR(s.remaining_amount)}</span></div>
                  <div>الدفع: <span className="text-foreground">{s.payment_method ?? "—"}</span></div>
                </div>
                <div className="mt-1 text-[11px] text-amber-200/80">سبب الاقتراح: {s.reason || "—"}</div>
                <div className="mt-2">
                  <button
                    disabled={busy !== null}
                    onClick={() => doLink(s.invoice_id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25 disabled:opacity-50"
                  >
                    {busy === s.invoice_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 size={13} />} ربط بالفاتورة
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
