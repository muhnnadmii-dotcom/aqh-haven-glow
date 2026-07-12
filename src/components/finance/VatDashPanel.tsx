import { useEffect, useState } from "react";
import { fetchVatPanel, type VatPanelData } from "@/lib/finance/dashboard-panels";
import { fmtSAR } from "@/lib/finance/constants";
import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, XCircle, FileClock, Scale, CalendarClock, FileEdit } from "lucide-react";

export function VatDashPanel() {
  const [data, setData] = useState<VatPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchVatPanel()
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading || !data) return <div className="text-center text-xs text-muted-foreground py-8">جاري تحميل بيانات الضريبة…</div>;
  if (!data.period_id) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-3">
        <div className="text-sm">لا توجد فترة ضريبية نشطة.</div>
        <Link to="/admin/finance/vat/periods" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px]">
          إنشاء فترة أولى
        </Link>
      </div>
    );
  }

  const netLabel = data.net_due > 0 ? "صافي الضريبة المتوقع (مستحق)" : "صافي الضريبة المتوقع (رصيد دائن)";
  const netValue = data.net_due > 0 ? data.net_due : data.net_credit;
  const netTone = data.net_due > 0 ? "text-red-300" : "text-emerald-300";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>الفترة النشطة: <span className="text-foreground font-mono">{data.period_label}</span></span>
        <Link to="/admin/finance/vat" className="text-gold hover:underline text-[11px]">فتح لوحة الضريبة الكاملة</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card icon={TrendingUp} label="ضريبة المخرجات" value={fmtSAR(data.output_vat)} tone="text-emerald-300" href="/admin/finance/vat/sales" />
        <Card icon={TrendingDown} label="المدخلات القابلة للخصم" value={fmtSAR(data.input_vat_deductible)} tone="text-sky-300" href="/admin/finance/vat/purchases" />
        <Card icon={XCircle} label="المدخلات غير القابلة" value={fmtSAR(data.input_vat_non_deductible)} tone="text-muted-foreground" href="/admin/finance/vat/purchases" />
        <Card icon={FileClock} label="مستندات تنتظر المراجعة" value={String(data.pending_review_count)} tone="text-amber-300" href="/admin/finance/vat/excluded" />
        <Card icon={Scale} label={netLabel} value={fmtSAR(netValue)} tone={netTone} href="/admin/finance/vat/draft" />
        <Card icon={CalendarClock} label="موعد الإقرار" value={fmtDate(data.filing_deadline)} tone="text-gold" href="/admin/finance/vat/periods" />
      </div>

      <div className="flex justify-end">
        <Link to="/admin/finance/vat/draft" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold text-[12px]">
          <FileEdit size={13} /> فتح مسودة الإقرار
        </Link>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, tone, href }: { icon: any; label: string; value: string; tone?: string; href?: string }) {
  const inner = (
    <>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{label}</span><Icon size={13} /></div>
      <div className={`mt-2 text-lg font-semibold font-mono ${tone ?? ""}`}>{value}</div>
    </>
  );
  if (href) return <Link to={href} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-gold/30 transition">{inner}</Link>;
  return <div className="rounded-xl border border-white/10 bg-white/5 p-4">{inner}</div>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return iso; }
}
