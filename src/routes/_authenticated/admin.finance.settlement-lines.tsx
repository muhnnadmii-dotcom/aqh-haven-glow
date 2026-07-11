import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/settlement-lines")({
  ssr: false,
  component: SettlementLinesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    settlement: (s.settlement as string) || undefined,
    provider: (s.provider as string) || undefined,
  }),
});

const LINE_LABEL: Record<string, string> = {
  sale: "مبيع",
  refund: "مرتجع",
  fee: "رسوم",
  fee_vat: "ضريبة الرسوم",
  payout_fee: "رسوم تحويل",
  adjustment: "تسوية",
  reserve_held: "احتياطي محتجز",
  reserve_released: "احتياطي مُفرج عنه",
  rounding_difference: "فرق تقريب",
  unexplained_transfer_fee: "فرق تحويل غير مبرر",
};

function SettlementLinesPage() {
  const search = Route.useSearch();
  const [rows, setRows] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [filterType, setFilterType] = useState("");
  const [filterSettlement, setFilterSettlement] = useState(search.settlement || "");
  const [filterProvider, setFilterProvider] = useState(search.provider || "");

  const load = async () => {
    const [l, s, p] = await Promise.all([
      supabase.from("payment_settlement_lines" as any).select("*").order("transaction_date", { ascending: false }).limit(1000),
      supabase.from("payment_settlements" as any).select("id,settlement_reference,settlement_date,provider_id"),
      supabase.from("payment_providers" as any).select("id,name"),
    ]);
    if (l.error) toast.error(l.error.message); else setRows(l.data ?? []);
    setSettlements(s.data ?? []);
    setProviders(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filterType && r.line_type !== filterType) return false;
    if (filterSettlement && r.settlement_id !== filterSettlement) return false;
    if (filterProvider) {
      const st = settlements.find((s) => s.id === r.settlement_id);
      if (!st || st.provider_id !== filterProvider) return false;
    }
    return true;
  }), [rows, filterType, filterSettlement, filterProvider, settlements]);

  const stName = (id: string) => {
    const s = settlements.find((x) => x.id === id);
    return s ? `${s.settlement_reference || s.settlement_date}` : "—";
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">حركات التسويات</h2>
        <p className="text-[11px] text-muted-foreground mt-1">جميع تفاصيل التسويات (مبيعات، مرتجعات، رسوم، ضريبة رسوم، تسويات احتياطي، فروقات).</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل البوابات</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterSettlement} onChange={(e) => setFilterSettlement(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل التسويات</option>
          {settlements.map((s) => <option key={s.id} value={s.id}>{s.settlement_reference || s.settlement_date}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل الأنواع</option>
          {Object.entries(LINE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2">التسوية</th>
              <th className="text-start px-3 py-2">النوع</th>
              <th className="text-start px-3 py-2">رقم الطلب</th>
              <th className="text-start px-3 py-2">مرجع الوسيط</th>
              <th className="text-start px-3 py-2">المبلغ</th>
              <th className="text-start px-3 py-2">الوصف</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">لا توجد حركات</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-2">{r.transaction_date ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{stName(r.settlement_id)}</td>
                <td className="px-3 py-2">{LINE_LABEL[r.line_type] ?? r.line_type}</td>
                <td className="px-3 py-2">{r.external_order_id ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground text-[10px]">{r.provider_transaction_id ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{Number(r.amount).toFixed(2)}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
