import { useEffect, useState, useMemo } from "react";
import { fmtSAR } from "@/lib/finance/constants";
import { getAccountingPerformance, type AccountingPerformance } from "@/lib/finance/accounting-performance";
import { AccountingRowsDrawer, type AccountingDrillSpec } from "./AccountingRowsDrawer";
import { TrendingUp, Package, Users2, Building, Receipt, AlertTriangle, Percent } from "lucide-react";

export function AccountingPanel({ from, to }: { from: string; to: string }) {
  const [perf, setPerf] = useState<AccountingPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<AccountingDrillSpec | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const p = await getAccountingPerformance(from, to);
        if (alive) setPerf(p);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [from, to]);

  const rangeLabel = useMemo(() => `${from} → ${to}`, [from, to]);

  const open = (spec: AccountingDrillSpec) => setDrill(spec);

  if (loading || !perf) {
    return <div className="text-center text-xs text-muted-foreground py-8">جاري تحميل بيانات الأداء المحاسبي…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-muted-foreground">
        الفترة: <span className="text-foreground font-mono">{rangeLabel}</span> — المصدر: الفواتير المعتمدة والقيود المرحّلة.
      </div>

      {/* Sales row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AcctCard
          icon={TrendingUp}
          label="المبيعات قبل الضريبة (إجمالي)"
          value={perf.gross_sales}
          tone="text-emerald-300"
          onClick={() => open({ title: "المبيعات — الفواتير المعتمدة", from, to, kind: "sales_invoices" })}
        />
        <AcctCard
          icon={Percent}
          label="الخصومات على المبيعات"
          value={perf.sales_discounts}
          tone="text-amber-300"
          onClick={() => open({ title: "الفواتير ذات الخصومات", from, to, kind: "sales_invoices" })}
        />
        <AcctCard
          icon={TrendingUp}
          label="صافي المبيعات"
          value={perf.net_sales}
          tone="text-emerald-300"
          accent="border-emerald-500/30 bg-emerald-500/5"
          onClick={() => open({ title: "الفواتير المعتمدة", from, to, kind: "sales_invoices" })}
        />
      </div>

      {/* Profit row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {perf.cogs_available ? (
          <AcctCard
            icon={Package}
            label="تكلفة البضاعة المباعة"
            value={perf.cogs ?? 0}
            tone="text-red-300"
            onClick={() => open({ title: "قيود تكلفة البضاعة المباعة", from, to, kind: "journal_by_system_key", systemKey: "cogs" })}
          />
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 text-amber-300 text-[12px] font-semibold">
              <AlertTriangle size={14} /> تكلفة البضاعة المباعة
            </div>
            <div className="mt-2 text-[12px] text-muted-foreground">
              غير مكتمل — يحتاج ربط تكلفة المخزون.
            </div>
          </div>
        )}
        {perf.cogs_available ? (
          <AcctCard
            icon={TrendingUp}
            label="مجمل الربح"
            value={perf.gross_profit ?? 0}
            tone={(perf.gross_profit ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}
            accent="border-gold/30 bg-gold/5"
          />
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[12px] text-muted-foreground">مجمل الربح</div>
            <div className="mt-2 text-[12px] text-amber-300">لا يُحسب بدون تكلفة البضاعة المباعة</div>
          </div>
        )}
        <AcctCard
          icon={Receipt}
          label="المصروفات التشغيلية"
          value={perf.operating_expenses}
          tone="text-red-300"
          onClick={() => open({ title: "قيود المصروفات التشغيلية", from, to, kind: "journal_by_type", accountType: "expense" })}
          hint="لا تشمل تكلفة البضاعة أو سحوبات المالك"
        />
      </div>

      {/* Net profit */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-5">
        <div className="text-[12px] text-muted-foreground">صافي الربح المحاسبي</div>
        <div className={`mt-2 text-3xl font-semibold font-mono ${perf.net_profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
          {fmtSAR(perf.net_profit)} <span className="text-xs text-muted-foreground">ر.س</span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {perf.cogs_available
            ? "= صافي المبيعات − تكلفة البضاعة − المصروفات التشغيلية"
            : "= صافي المبيعات − المصروفات التشغيلية (بدون تكلفة البضاعة)"}
        </div>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AcctCard
          icon={Users2}
          label="أرصدة العملاء (مستحقة)"
          value={perf.ar_balance}
          tone="text-sky-300"
          onClick={() => open({ title: "قيود ذمم العملاء", from, to, kind: "journal_by_system_key", systemKey: "accounts_receivable", asOfMode: true })}
        />
        <AcctCard
          icon={Building}
          label="أرصدة الموردين (مستحقة عليهم)"
          value={perf.ap_balance}
          tone="text-orange-300"
          onClick={() => open({ title: "قيود ذمم الموردين", from, to, kind: "journal_by_system_key", systemKey: "accounts_payable", asOfMode: true })}
        />
        <AcctCard
          icon={Package}
          label="قيمة المخزون"
          value={perf.inventory_value}
          tone="text-emerald-300"
          hint="من حساب المخزون أو الرصيد اليدوي"
        />
      </div>

      {/* VAT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AcctCard
          icon={Percent}
          label="ضريبة المخرجات"
          value={perf.output_vat}
          tone="text-amber-300"
          onClick={() => open({ title: "ضريبة المخرجات — فواتير مبيعات", from, to, kind: "sales_invoices" })}
        />
        <AcctCard
          icon={Percent}
          label="ضريبة المدخلات القابلة للخصم"
          value={perf.deductible_input_vat}
          tone="text-sky-300"
          onClick={() => open({ title: "ضريبة المدخلات — فواتير مشتريات", from, to, kind: "purchase_invoices" })}
        />
        <AcctCard
          icon={Percent}
          label="صافي الضريبة المتوقع"
          value={perf.net_vat}
          tone={perf.net_vat >= 0 ? "text-red-300" : "text-emerald-300"}
          accent="border-amber-500/30 bg-amber-500/5"
          hint="مخرجات − مدخلات قابلة للخصم"
        />
      </div>

      {drill && <AccountingRowsDrawer spec={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function AcctCard({ icon: Icon, label, value, tone, accent, hint, onClick }: {
  icon: any; label: string; value: number; tone?: string; accent?: string; hint?: string; onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`text-right rounded-xl border p-4 transition ${accent ?? "border-white/10 bg-white/5"} ${onClick ? "hover:bg-white/10 hover:border-gold/30 cursor-pointer" : "cursor-default"}`}>
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>{label}</span>
        <Icon size={15} className={tone} />
      </div>
      <div className={`mt-2 text-xl font-semibold font-mono ${tone ?? ""}`}>
        {fmtSAR(value)} <span className="text-[10px] text-muted-foreground">ر.س</span>
      </div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </button>
  );
}
