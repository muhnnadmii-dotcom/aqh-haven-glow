import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR } from "@/lib/finance/constants";
import { ArrowLeftRight, TrendingUp, TrendingDown, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/owner-account")({
  ssr: false,
  component: OwnerAccountPage,
});

type OwnerSummary = {
  collected_by_owner: number;
  paid_by_owner: number;
  owner_to_company: number;
  company_to_owner: number;
  amount_due_from_owner: number;
  amount_due_to_owner: number;
  net_owner_balance: number;
};

function OwnerAccountPage() {
  const [sum, setSum] = useState<OwnerSummary | null>(null);
  const [incs, setIncs] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: rpc }, { data: ownerAccounts }] = await Promise.all([
        supabase.rpc("get_owner_current_account"),
        supabase.from("finance_accounts").select("id").eq("account_owner_type", "owner"),
      ]);
      if (rpc && rpc.length > 0) {
        const r = rpc[0] as any;
        setSum({
          collected_by_owner: Number(r.collected_by_owner ?? 0),
          paid_by_owner: Number(r.paid_by_owner ?? 0),
          owner_to_company: Number(r.owner_to_company ?? 0),
          company_to_owner: Number(r.company_to_owner ?? 0),
          amount_due_from_owner: Number(r.amount_due_from_owner ?? 0),
          amount_due_to_owner: Number(r.amount_due_to_owner ?? 0),
          net_owner_balance: Number(r.net_owner_balance ?? 0),
        });
      } else {
        setSum({ collected_by_owner: 0, paid_by_owner: 0, owner_to_company: 0, company_to_owner: 0, amount_due_from_owner: 0, amount_due_to_owner: 0, net_owner_balance: 0 });
      }

      const ownerIds = (ownerAccounts ?? []).map((a: any) => a.id);
      if (ownerIds.length > 0) {
        const [{ data: i }, { data: e }] = await Promise.all([
          supabase.from("finance_incomes").select("id, income_date, amount, note, business_relation, transaction_type, account_id").in("account_id", ownerIds).is("deleted_at", null).order("income_date", { ascending: false }).limit(50),
          supabase.from("finance_expenses").select("id, expense_date, amount, item_name, business_relation, transaction_type, account_id").in("account_id", ownerIds).is("deleted_at", null).order("expense_date", { ascending: false }).limit(50),
        ]);
        setIncs(i ?? []);
        setExps(e ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const dueFrom = sum?.amount_due_from_owner ?? 0;
  const dueTo = sum?.amount_due_to_owner ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2"><ArrowLeftRight size={16} className="text-gold" /> حساب جاري المالك</h2>
        <p className="text-[11px] text-muted-foreground mt-1">يوضح العلاقة المالية بين المالك والمنشأة (تحصيلات النشاط على حساباته الشخصية والمصروفات التي دفعها نيابة عن النشاط).</p>
      </div>

      {/* Net card */}
      <div className={`rounded-2xl border p-5 ${dueFrom > 0 ? "border-emerald-400/30 bg-emerald-500/5" : dueTo > 0 ? "border-amber-400/30 bg-amber-500/5" : "border-white/10 bg-white/5"}`}>
        <div className="text-[11px] text-muted-foreground">صافي التسوية الحالي</div>
        {dueFrom > 0 && (
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-300">{fmtSAR(dueFrom)}</div>
            <div className="text-[12px] mt-1">على المالك للمنشأة</div>
          </div>
        )}
        {dueTo > 0 && (
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-300">{fmtSAR(dueTo)}</div>
            <div className="text-[12px] mt-1">للمالك على المنشأة</div>
          </div>
        )}
        {dueFrom === 0 && dueTo === 0 && (
          <div className="mt-2 text-lg font-semibold text-muted-foreground">لا توجد فروقات - الحساب متساوٍ</div>
        )}
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={<TrendingUp size={14} className="text-emerald-400" />} label="تحصيلات نشاط على المالك" value={sum?.collected_by_owner ?? 0} hint="مبالغ استلمها المالك من عملاء النشاط" />
        <Card icon={<TrendingDown size={14} className="text-red-400" />} label="مصروفات نشاط دفعها المالك" value={sum?.paid_by_owner ?? 0} hint="مبالغ دفعها المالك نيابة عن النشاط" />
        <Card icon={<ArrowLeftRight size={14} className="text-sky-400" />} label="سلّمه المالك للمنشأة" value={sum?.owner_to_company ?? 0} hint="تحويلات من الشخصي إلى التجاري (تسوية)" />
        <Card icon={<ArrowLeftRight size={14} className="text-purple-400" />} label="أعادته المنشأة للمالك" value={sum?.company_to_owner ?? 0} hint="تحويلات من التجاري إلى الشخصي (تسوية)" />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
        <Info size={13} className="mt-0.5 text-sky-400 flex-shrink-0" />
        <div>
          صافي رصيد جاري المالك = (تحصيلات المالك − ما سلّمه للمنشأة) − (مصروفات دفعها المالك − ما أعادته المنشأة). يتم احتساب المقاصة تلقائيًا؛ التفاصيل الكاملة لكل حركة تبقى محفوظة.
        </div>
      </div>

      {/* Recent movements on owner accounts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-[12px] font-semibold mb-2">آخر مقبوضات على الحسابات الشخصية</div>
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5 text-muted-foreground">
                <tr><th className="text-start px-2 py-1.5">التاريخ</th><th className="text-start px-2 py-1.5">البيان</th><th className="text-start px-2 py-1.5">العلاقة</th><th className="text-start px-2 py-1.5">المبلغ</th></tr>
              </thead>
              <tbody>
                {incs.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-2 py-1.5">{r.income_date}</td>
                    <td className="px-2 py-1.5 truncate max-w-[180px]">{r.note || "—"}</td>
                    <td className="px-2 py-1.5">{relationLabel(r.business_relation)}</td>
                    <td className="px-2 py-1.5 font-mono">{fmtSAR(r.amount)}</td>
                  </tr>
                ))}
                {incs.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">{loading ? "..." : "لا توجد حركات"}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold mb-2">آخر مدفوعات من الحسابات الشخصية</div>
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5 text-muted-foreground">
                <tr><th className="text-start px-2 py-1.5">التاريخ</th><th className="text-start px-2 py-1.5">البيان</th><th className="text-start px-2 py-1.5">العلاقة</th><th className="text-start px-2 py-1.5">المبلغ</th></tr>
              </thead>
              <tbody>
                {exps.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-2 py-1.5">{r.expense_date}</td>
                    <td className="px-2 py-1.5 truncate max-w-[180px]">{r.item_name || "—"}</td>
                    <td className="px-2 py-1.5">{relationLabel(r.business_relation)}</td>
                    <td className="px-2 py-1.5 font-mono">{fmtSAR(r.amount)}</td>
                  </tr>
                ))}
                {exps.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">{loading ? "..." : "لا توجد حركات"}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
      <div className="text-lg font-semibold mt-1 font-mono">{fmtSAR(value)}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function relationLabel(v: string | null | undefined) {
  switch (v) {
    case "business": return <span className="text-emerald-300">نشاط</span>;
    case "personal": return <span className="text-muted-foreground">شخصي</span>;
    case "owner_settlement": return <span className="text-sky-300">تسوية مالك</span>;
    case "internal_transfer": return <span className="text-purple-300">تحويل</span>;
    default: return <span className="text-amber-300">غير مصنّفة</span>;
  }
}
