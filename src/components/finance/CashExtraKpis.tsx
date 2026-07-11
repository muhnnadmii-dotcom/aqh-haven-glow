import { useEffect, useState } from "react";
import { fetchCashExtras, type CashExtras } from "@/lib/finance/dashboard-panels";
import { fmtSAR } from "@/lib/finance/constants";
import { Landmark, User, ArrowLeftRight, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CashExtraKpis({ from, to }: { from: string | null; to: string | null }) {
  const [data, setData] = useState<CashExtras | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCashExtras(from, to)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [from, to]);

  if (loading || !data) {
    return <div className="text-[11px] text-muted-foreground py-2">جاري تحميل مؤشرات النقد الإضافية…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground px-1">مستحقات وحسابات مرتبطة بالنشاط</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {data.providerReceivables.map((p) => (
          <Link key={p.provider_id} to="/admin/finance/settlements"
            className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-gold/30 transition">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>مستحقات {p.name}</span>
              <Landmark size={13} className="text-gold" />
            </div>
            <div className="mt-1 text-lg font-semibold font-mono text-gold">{fmtSAR(p.awaiting_amount)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{p.count} تسوية</div>
          </Link>
        ))}
        <Link to="/admin/finance/incomes"
          className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-gold/30 transition">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>مبالغ نشاط في الحساب الشخصي</span>
            <User size={13} className="text-sky-300" />
          </div>
          <div className="mt-1 text-lg font-semibold font-mono text-sky-300">{fmtSAR(data.personalBusinessNet)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            + {fmtSAR(data.personalBusinessOut)} مصروف / − {fmtSAR(data.personalBusinessIn)} تحصيل
          </div>
        </Link>
        <Link to="/admin/finance/owner-account"
          className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-gold/30 transition">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>مستحقات المالك</span>
            <Wallet size={13} className="text-amber-300" />
          </div>
          <div className={`mt-1 text-lg font-semibold font-mono ${data.ownerSettlementBalance >= 0 ? "text-amber-300" : "text-emerald-300"}`}>
            {fmtSAR(Math.abs(data.ownerSettlementBalance))}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {data.ownerSettlementBalance >= 0 ? "مستحق للمالك" : "مستحق على المالك"}
          </div>
        </Link>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>التحويلات الداخلية</span>
            <ArrowLeftRight size={13} className="text-muted-foreground" />
          </div>
          <div className="mt-1 text-lg font-semibold font-mono">{fmtSAR(data.internalTransfersAmount)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">{data.internalTransfersCount} حركة</div>
        </div>
      </div>
    </div>
  );
}
