import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/finance/general-ledger")({
  ssr: false,
  component: GeneralLedgerPage,
});

function GeneralLedgerPage() {
  const y = new Date().getFullYear();
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: accounts } = useQuery({
    queryKey: ["coa-all"],
    queryFn: async () => {
      const { data } = await supabase.from("chart_of_accounts").select("id,code,name_ar").eq("is_active", true).order("code");
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ledger", accountId, from, to],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.rpc("get_general_ledger", { p_account_id: accountId, p_from: from, p_to: to });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">دفتر الأستاذ</h2>
      <div className="flex gap-2 flex-wrap">
        <select className="bg-white/5 border border-white/10 rounded-md px-2 text-sm min-w-[250px]" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">اختر حساب</option>
          {(accounts || []).map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}
        </select>
        <div><label className="text-xs text-muted-foreground">من</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">إلى</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {!accountId ? <p className="text-muted-foreground text-sm">اختر حساب لعرض الحركات</p> :
        isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto"><table className="min-w-full text-sm">
            <thead className="bg-white/5 text-xs">
              <tr>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">القيد</th>
                <th className="p-2 text-right">الوصف</th>
                <th className="p-2 text-right">مدين</th>
                <th className="p-2 text-right">دائن</th>
                <th className="p-2 text-right">الرصيد الجاري</th>
              </tr>
            </thead>
            <tbody>
              {((data || []) as any[]).map((r: any, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="p-2">{r.entry_date}</td>
                  <td className="p-2 font-mono text-xs">{r.entry_number}</td>
                  <td className="p-2">{r.description}</td>
                  <td className="p-2 font-mono">{Number(r.debit) > 0 ? Number(r.debit).toFixed(2) : ""}</td>
                  <td className="p-2 font-mono">{Number(r.credit) > 0 ? Number(r.credit).toFixed(2) : ""}</td>
                  <td className={`p-2 font-mono ${Number(r.running_balance) < 0 ? "text-red-300" : ""}`}>{Number(r.running_balance).toFixed(2)}</td>
                </tr>
              ))}
              {((data || []) as any[]).length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-sm">لا توجد حركات</td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
