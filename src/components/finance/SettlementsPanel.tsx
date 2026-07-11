import { useEffect, useState } from "react";
import { fetchSettlementsSummary, type SettlementsSummary } from "@/lib/finance/dashboard-panels";
import { fmtSAR } from "@/lib/finance/constants";
import { Link } from "@tanstack/react-router";
import { Landmark, AlertTriangle, Percent, Receipt, Sigma, Scale } from "lucide-react";

export function SettlementsPanel({ from, to }: { from: string | null; to: string | null }) {
  const [data, setData] = useState<SettlementsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchSettlementsSummary(from, to)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [from, to]);

  if (loading || !data) return <div className="text-center text-xs text-muted-foreground py-8">جاري تحميل بيانات التسويات…</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-muted-foreground">
        الفترة: <span className="text-foreground font-mono">{from ?? "—"} → {to ?? "—"}</span> — المصدر: تسويات بوابات الدفع.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Landmark} label="بانتظار التحويل" value={fmtSAR(data.awaiting_payout.amount)} sub={`${data.awaiting_payout.count} تسوية`} tone="text-gold" href="/admin/finance/settlements" />
        <Card icon={AlertTriangle} label="غير مطابقة" value={fmtSAR(data.unmatched.amount)} sub={`${data.unmatched.count} تسوية`} tone="text-amber-300" href="/admin/finance/settlements-review" />
        <Card icon={Percent} label="رسوم الوسطاء" value={fmtSAR(data.fees_total)} tone="text-red-300" href="/admin/finance/provider-fee-invoices" />
        <Card icon={Receipt} label="ضريبة الرسوم" value={fmtSAR(data.fees_vat_total)} tone="text-muted-foreground" href="/admin/finance/provider-fee-invoices" />
        <Card icon={Scale} label="فروقات التقريب" value={fmtSAR(data.rounding_diff_total)} tone="text-muted-foreground" />
        <Card icon={AlertTriangle} label="فروقات غير مفسرة" value={fmtSAR(data.unexplained_diff_total)} tone={data.unexplained_diff_total !== 0 ? "text-red-300" : "text-muted-foreground"} href="/admin/finance/settlements-review" />
        <Card icon={Sigma} label="إجمالي أرصدة الوسطاء" value={fmtSAR(data.providerBalances.reduce((a, b) => a + b.balance, 0))} tone="text-emerald-300" href="/admin/finance/provider-balances" />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">أرصدة الوسطاء</div>
        {data.providerBalances.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">لا يوجد وسطاء مفعّلون.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.providerBalances.map((p) => (
              <div key={p.provider_id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] text-muted-foreground">{p.name}</div>
                <div className={`mt-1 text-base font-semibold font-mono ${p.balance > 0 ? "text-gold" : "text-muted-foreground"}`}>{fmtSAR(p.balance)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, sub, tone, href }: { icon: any; label: string; value: string; sub?: string; tone?: string; href?: string }) {
  const inner = (
    <>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{label}</span><Icon size={13} /></div>
      <div className={`mt-2 text-lg font-semibold font-mono ${tone ?? ""}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-muted-foreground">{sub}</div>}
    </>
  );
  if (href) return <Link to={href} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-gold/30 transition">{inner}</Link>;
  return <div className="rounded-xl border border-white/10 bg-white/5 p-4">{inner}</div>;
}
