import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { FileMinus, FilePlus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/credit-debit-notes")({
  ssr: false,
  component: NotesListPage,
});

const SAR = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ﷼";

const TYPE_LABEL: Record<string, string> = {
  sales_credit_note: "دائن — مبيعات",
  sales_debit_note: "مدين — مبيعات",
  purchase_credit_note: "دائن — مشتريات",
  purchase_debit_note: "مدين — مشتريات",
};
const STATUS_LABEL: Record<string, string> = { draft: "مسودة", approved: "معتمد", cancelled: "ملغى" };

function NotesListPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cdn-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_debit_notes" as any)
        .select("id, note_number, note_type, issue_date, status, total_amount, vat_amount, reason, original_sales_invoice_id, original_purchase_invoice_id")
        .order("issue_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (type && r.note_type !== type) return false;
      if (status && r.status !== status) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!(r.note_number?.toLowerCase().includes(s) || r.reason?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [rows, q, type, status]);

  const stats = useMemo(() => {
    let credit = 0, debit = 0;
    for (const r of filtered) {
      if (r.status !== "approved") continue;
      if (r.note_type.endsWith("credit_note")) credit += Number(r.total_amount);
      else debit += Number(r.total_amount);
    }
    return { credit, debit, net: debit - credit };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">الإشعارات الدائنة والمدينة</h2>
        <p className="text-[12px] text-muted-foreground">تصحيح الفواتير المعتمدة بدون تعديلها. يتم إنشاء الإشعارات من صفحة الفاتورة الأصلية.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="إجمالي الدائنة (معتمدة)" value={SAR(stats.credit)} tone="rose" />
        <Stat label="إجمالي المدينة (معتمدة)" value={SAR(stats.debit)} tone="emerald" />
        <Stat label="الأثر الصافي" value={SAR(stats.net)} tone={stats.net >= 0 ? "emerald" : "rose"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالرقم أو السبب…"
                 className="w-full pr-7 pl-2 py-1.5 rounded bg-black/40 border border-white/10 text-[12px]" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-1.5 rounded bg-black/40 border border-white/10 text-[12px]">
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2 py-1.5 rounded bg-black/40 border border-white/10 text-[12px]">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-[12px] min-w-[720px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">الرقم</th>
              <th className="text-right p-2">النوع</th>
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الفاتورة الأصلية</th>
              <th className="text-right p-2">السبب</th>
              <th className="text-right p-2">الضريبة</th>
              <th className="text-right p-2">الإجمالي</th>
              <th className="text-right p-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">جاري التحميل…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد إشعارات.</td></tr>}
            {filtered.map((r) => {
              const isSales = r.note_type.startsWith("sales");
              const linkTo = isSales
                ? `/admin/finance/sales-invoices/${r.original_sales_invoice_id}`
                : `/admin/finance/purchase-invoices/${r.original_purchase_invoice_id}`;
              const isCredit = r.note_type.endsWith("credit_note");
              return (
                <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-2 font-medium">{r.note_number}</td>
                  <td className="p-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${isCredit ? "bg-rose-500/10 border-rose-500/30 text-rose-200" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"}`}>
                      {isCredit ? <FileMinus size={10} /> : <FilePlus size={10} />} {TYPE_LABEL[r.note_type]}
                    </span>
                  </td>
                  <td className="p-2">{r.issue_date}</td>
                  <td className="p-2"><Link to={linkTo} className="text-gold hover:underline">فتح الفاتورة</Link></td>
                  <td className="p-2 max-w-[240px] truncate" title={r.reason}>{r.reason}</td>
                  <td className="p-2">{SAR(r.vat_amount)}</td>
                  <td className="p-2 font-semibold">{SAR(r.total_amount)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                      r.status === "approved" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : r.status === "cancelled" ? "bg-white/5 border-white/10 text-muted-foreground"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                    }`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "rose" | "emerald" }) {
  const c = tone === "rose" ? "text-rose-300" : "text-emerald-300";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${c}`}>{value}</div>
    </div>
  );
}
