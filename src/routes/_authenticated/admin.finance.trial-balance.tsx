import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/finance/trial-balance")({
  ssr: false,
  component: TrialBalancePage,
});

const TYPE_LABEL: Record<string, string> = { asset: "أصول", liability: "التزامات", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات" };

function TrialBalancePage() {
  const y = new Date().getFullYear();
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["trial-balance", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_trial_balance", { p_from: from, p_to: to });
      if (error) throw error;
      return data || [];
    },
  });

  const totals = useMemo(() => {
    const rows = (data || []) as any[];
    const d = rows.reduce((s, r) => s + Number(r.total_debit), 0);
    const c = rows.reduce((s, r) => s + Number(r.total_credit), 0);
    return { d, c };
  }, [data]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">ميزان المراجعة</h2>
      <div className="flex gap-2">
        <div><label className="text-xs text-muted-foreground">من</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">إلى</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs">
              <tr>
                <th className="p-2 text-right">الكود</th>
                <th className="p-2 text-right">الحساب</th>
                <th className="p-2 text-right">النوع</th>
                <th className="p-2 text-right">مدين</th>
                <th className="p-2 text-right">دائن</th>
                <th className="p-2 text-right">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {((data || []) as any[]).filter((r) => Number(r.total_debit) !== 0 || Number(r.total_credit) !== 0).map((r) => (
                <tr key={r.account_id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="p-2 font-mono">{r.code}</td>
                  <td className="p-2">{r.name_ar}</td>
                  <td className="p-2 text-xs text-muted-foreground">{TYPE_LABEL[r.account_type]}</td>
                  <td className="p-2 font-mono">{Number(r.total_debit).toFixed(2)}</td>
                  <td className="p-2 font-mono">{Number(r.total_credit).toFixed(2)}</td>
                  <td className={`p-2 font-mono ${Number(r.balance) < 0 ? "text-red-300" : ""}`}>{Number(r.balance).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-white/5 font-semibold">
              <tr>
                <td className="p-2" colSpan={3}>الإجمالي</td>
                <td className="p-2 font-mono">{totals.d.toFixed(2)}</td>
                <td className="p-2 font-mono">{totals.c.toFixed(2)}</td>
                <td className="p-2 font-mono">{(totals.d - totals.c).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
