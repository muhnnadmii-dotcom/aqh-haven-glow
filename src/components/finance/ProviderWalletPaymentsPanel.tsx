import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Wallet, RotateCcw } from "lucide-react";

type Props = {
  invoiceId: number;
  invoiceStatus: string;
  paymentProviderId: string | null;
  remaining: number;
  canManage: boolean;
  onChanged?: () => void;
};

function fmt(n: any) { return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function ProviderWalletPaymentsPanel({ invoiceId, invoiceStatus, paymentProviderId, remaining, canManage, onChanged }: Props) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isEligible =
    !!paymentProviderId && invoiceStatus !== "draft" && invoiceStatus !== "rejected" && Number(remaining) > 0;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("purchase_invoice_provider_payments" as any)
      .select("id, payment_date, amount, status, source_account_id, journal_entry_id, notes, confirmed_at, reversed_at, reversed_reason")
      .eq("purchase_invoice_id", invoiceId)
      .order("payment_date", { ascending: false });
    setPayments((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [invoiceId]);

  const runPreview = async () => {
    setBusy(true);
    const parsed = amount ? Number(amount) : null;
    const { data, error } = await supabase.rpc("preview_provider_invoice_payment" as any, {
      p_invoice_id: invoiceId,
      p_amount: parsed,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPreview(data);
    setShowPreview(true);
  };

  const confirmPayment = async () => {
    if (!preview) return;
    if (!confirm(`تأكيد دفع ${fmt(preview.amount)} ر.س من رصيد ${preview.source_account.name_ar}؟ لن يتأثر البنك أو الكاش.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("confirm_provider_invoice_payment" as any, {
      p_invoice_id: invoiceId,
      p_amount: preview.amount,
      p_payment_date: null,
      p_source_account_id: preview.source_account.id,
      p_notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الدفعة والقيد كمسودة للمراجعة.");
    setShowPreview(false);
    setPreview(null);
    setAmount("");
    setNotes("");
    await load();
    onChanged?.();
  };

  const reverse = async (id: string) => {
    const reason = prompt("سبب عكس هذه الدفعة؟");
    if (!reason || !reason.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("reverse_provider_invoice_payment" as any, { p_payment_id: id, p_reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم عكس الدفعة.");
    await load();
    onChanged?.();
  };

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-gold" /> دفعات من رصيد بوابة الدفع</h3>
        <div className="text-[10px] text-muted-foreground">مسار منفصل عن المصروفات · لا يؤثر على البنك/الكاش</div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm py-2 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />جارٍ التحميل…</div>
      ) : payments.length === 0 ? (
        <div className="text-muted-foreground text-sm">لا توجد دفعات من رصيد البوابة بعد.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-right p-1">التاريخ</th>
                <th className="text-right p-1">المبلغ</th>
                <th className="text-right p-1">الحالة</th>
                <th className="text-right p-1">القيد</th>
                <th className="text-right p-1">ملاحظات</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="p-1 whitespace-nowrap">{p.payment_date}</td>
                  <td className="p-1 font-semibold">{fmt(p.amount)}</td>
                  <td className="p-1">
                    {p.status === "confirmed" && <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">مؤكدة</Badge>}
                    {p.status === "draft" && <Badge variant="outline">مسودة</Badge>}
                    {p.status === "reversed" && <Badge className="bg-red-500/20 text-red-300 border-red-500/30">معكوسة</Badge>}
                  </td>
                  <td className="p-1 text-xs font-mono">{p.journal_entry_id ? String(p.journal_entry_id).slice(0, 8) : "—"}</td>
                  <td className="p-1 text-muted-foreground text-xs">{p.notes || p.reversed_reason || ""}</td>
                  <td className="p-1">
                    {canManage && p.status === "confirmed" && (
                      <button className="text-amber-300 hover:text-amber-200 text-xs inline-flex items-center gap-1" onClick={() => reverse(p.id)} disabled={busy}>
                        <RotateCcw className="w-3 h-3" /> عكس
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && isEligible && (
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">المبلغ (اختياري)</label>
              <Input type="number" step="0.01" placeholder={fmt(remaining)} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">ملاحظات</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات على الدفعة" />
            </div>
            <Button variant="outline" onClick={runPreview} disabled={busy}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "معاينة دفع من رصيد البوابة"}
            </Button>
          </div>

          {showPreview && preview && (
            <div className="mt-2 rounded-lg bg-emerald-500/5 border border-emerald-500/30 p-3 space-y-2">
              <div className="text-sm font-semibold text-emerald-300">معاينة القيد المحاسبي</div>
              <div className="text-xs">البوابة: <b>{preview.provider.name}</b></div>
              <div className="text-xs">الحساب المصدر: <b>{preview.source_account.code} — {preview.source_account.name_ar}</b> {preview.source_account.is_wallet ? <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 ms-1">محفظة</Badge> : <Badge variant="outline" className="ms-1">حساب وسيط</Badge>}</div>
              <div className="text-xs">المبلغ: <b>{fmt(preview.amount)}</b></div>
              <table className="w-full text-xs mt-2">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-right p-1">الحساب</th>
                    <th className="text-right p-1">مدين</th>
                    <th className="text-right p-1">دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.preview_entry as any[]).map((l, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="p-1">{l.account_code} — {l.account_name}</td>
                      <td className="p-1 font-mono">{l.type === "debit" ? fmt(l.amount) : ""}</td>
                      <td className="p-1 font-mono">{l.type === "credit" ? fmt(l.amount) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
                تأثير الكاش والبنك: صفر
              </div>
              {Array.isArray(preview.warnings) && (preview.warnings as string[]).includes("no_wallet_account_using_clearing") && (
                <div className="mt-2 flex items-start gap-1 text-[11px] text-amber-300">
                  <AlertTriangle className="w-3 h-3 mt-0.5" />
                  <span>لم يتم تعيين حساب محفظة للبوابة. سيتم استخدام حساب الوسيط (Clearing). يمكن للأدمن تحديد حساب محفظة من إعدادات البوابات.</span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={confirmPayment} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500">
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "تأكيد الدفعة وإنشاء قيد مسودة"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowPreview(false); setPreview(null); }}>إلغاء</Button>
              </div>
              <div className="text-[10px] text-muted-foreground">
                القيد يُنشأ بحالة "مسودة" ويتطلب مراجعة المحاسب قبل الترحيل.
              </div>
            </div>
          )}
        </div>
      )}

      {!isEligible && canManage && (
        <div className="text-[11px] text-muted-foreground">
          {!paymentProviderId
            ? "هذه الفاتورة غير مرتبطة ببوابة دفع."
            : invoiceStatus === "draft" || invoiceStatus === "rejected"
              ? "لا يمكن تسجيل دفعة من رصيد البوابة قبل اعتماد الفاتورة."
              : "لا يوجد متبقٍ للسداد."}
        </div>
      )}
    </div>
  );
}
