import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/provider-balances")({
  ssr: false,
  component: ProviderBalancesPage,
});

type Row = {
  provider_id: string;
  provider_name: string;
  clearing_account: string;
  expected_pending: number;
  awaiting_payout: number;
  total_settled: number;
  total_paid: number;
};

function ProviderBalancesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: providers, error: pe }, { data: settlements, error: se }, { data: coa }] = await Promise.all([
      supabase.from("payment_providers" as any).select("*").eq("is_active", true),
      supabase.from("payment_settlements" as any).select("*"),
      supabase.from("chart_of_accounts").select("id,code,name_ar"),
    ]);
    if (pe) { toast.error(pe.message); setLoading(false); return; }
    if (se) { toast.error(se.message); setLoading(false); return; }

    const out: Row[] = (providers ?? []).map((p: any) => {
      const list = (settlements ?? []).filter((s: any) => s.provider_id === p.id);
      const awaiting = list.filter((s: any) => s.status === "awaiting_payout").reduce((sum: number, s: any) => sum + Number(s.expected_net_amount), 0);
      const totalSettled = list.filter((s: any) => !["cancelled", "draft"].includes(s.status)).reduce((sum: number, s: any) => sum + Number(s.expected_net_amount), 0);
      const totalPaid = list.filter((s: any) => s.status === "paid").reduce((sum: number, s: any) => sum + Number(s.actual_bank_amount || 0), 0);
      const pending = totalSettled - totalPaid;
      const acc = (coa ?? []).find((a: any) => a.id === p.clearing_account_id);
      return {
        provider_id: p.id,
        provider_name: p.name,
        clearing_account: acc ? `${acc.code} — ${acc.name_ar}` : "غير مربوط",
        expected_pending: pending,
        awaiting_payout: awaiting,
        total_settled: totalSettled,
        total_paid: totalPaid,
      };
    });
    setRows(out);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grand = rows.reduce((s, r) => s + r.expected_pending, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">أرصدة معلقة لدى الوسطاء</h2>
        <p className="text-[11px] text-muted-foreground mt-1">المبالغ المستحقة لدى بوابات الدفع التي لم تُحوَّل للبنك بعد. لا تعتبر ضمن رصيد البنك.</p>
      </div>

      <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 flex justify-between items-center">
        <div className="text-[12px] text-muted-foreground">إجمالي المستحقات المعلقة لدى جميع الوسطاء</div>
        <div className="text-2xl font-semibold tabular-nums text-gold">{grand.toFixed(2)} ريال</div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground text-[12px] py-6">جارٍ التحميل…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-3 py-2">البوابة</th>
                <th className="text-start px-3 py-2">الحساب الوسيط</th>
                <th className="text-start px-3 py-2">إجمالي التسويات</th>
                <th className="text-start px-3 py-2">المحوّل فعليًا</th>
                <th className="text-start px-3 py-2">بانتظار التحويل</th>
                <th className="text-start px-3 py-2">الرصيد المعلق</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.provider_id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium">{r.provider_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.clearing_account}</td>
                  <td className="px-3 py-2 tabular-nums">{r.total_settled.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums text-emerald-400">{r.total_paid.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums text-amber-400">{r.awaiting_payout.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums font-semibold text-gold">{r.expected_pending.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
