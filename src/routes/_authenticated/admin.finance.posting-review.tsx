import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { fmtSAR } from "@/lib/finance/constants";

export const Route = createFileRoute("/_authenticated/admin/finance/posting-review")({
  ssr: false,
  component: PostingReviewPage,
});

type ScanRow = {
  op_kind: string;
  op_id: string;
  op_date: string;
  op_amount: number;
  counterparty: string | null;
  provider_code: string | null;
  existing_je_id: string | null;
  existing_je_number: string | null;
  existing_status: string | null;
  existing_total: number | null;
  existing_lines: any[];
  classification: "correct" | "draft_pending" | "missing" | "mismatch" | "duplicate" | "out_of_scope";
  diff_reason: string | null;
};

const OP_KIND_LABEL: Record<string, string> = {
  sales_invoice_approval: "اعتماد فاتورة مبيعات",
  purchase_invoice_approval: "اعتماد فاتورة مشتريات",
  purchase_invoice_payment: "سداد فاتورة مشتريات",
  internal_transfer: "تحويل داخلي",
  owner_withdrawal: "سحب/تسوية المالك",
  sales_invoice_collection: "تحصيل بوابة دفع",
  payment_settlement_payout: "تحويل تسوية للبنك",
};

const CLASS_META: Record<string, { label: string; cls: string }> = {
  correct:       { label: "مطابق",           cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  draft_pending: { label: "مسودة بانتظار",   cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  missing:       { label: "لا يوجد قيد",     cls: "bg-red-500/10 text-red-300 border-red-500/30" },
  mismatch:      { label: "فرق في المبلغ",   cls: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
  duplicate:     { label: "قيود مكررة",      cls: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30" },
  out_of_scope:  { label: "خارج النطاق",     cls: "bg-white/5 text-muted-foreground border-white/10" },
};

function PostingReviewPage() {
  const today = new Date();
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  );
  const [kindFilter, setKindFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const scan = useQuery({
    queryKey: ["finance_posting_scan", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_posting_scan" as any, { p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? []) as ScanRow[];
    },
  });

  const summary = useQuery({
    queryKey: ["finance_posting_summary", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_posting_summary" as any, { p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? []) as { op_kind: string; classification: string; cnt: number; total_amount: number }[];
    },
  });

  const rows = useMemo(() => {
    const list = scan.data ?? [];
    return list.filter(r =>
      (!kindFilter || r.op_kind === kindFilter) &&
      (!classFilter || r.classification === classFilter)
    );
  }, [scan.data, kindFilter, classFilter]);

  const totals = useMemo(() => {
    const t: Record<string, { cnt: number; amt: number }> = {};
    for (const s of summary.data ?? []) {
      const k = s.classification;
      if (!t[k]) t[k] = { cnt: 0, amt: 0 };
      t[k].cnt += Number(s.cnt);
      t[k].amt += Number(s.total_amount);
    }
    return t;
  }, [summary.data]);

  const toggle = (id: string) => {
    const n = new Set(expanded);
    n.has(id) ? n.delete(id) : n.add(id);
    setExpanded(n);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">مراجعة الترحيل المحاسبي</h2>
          <p className="text-xs text-muted-foreground mt-1">
            عرض للقراءة فقط. يقارن كل عملية معتمدة بقيدها المحاسبي الحالي دون أي تعديل على البيانات.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { scan.refetch(); summary.refetch(); }} className="gap-1">
          <RefreshCw size={14} /> تحديث
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <div><label className="text-xs text-muted-foreground">من</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">إلى</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <label className="text-xs text-muted-foreground">نوع العملية</label>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}
            className="block bg-white/5 border border-white/10 rounded-md px-2 h-9 text-sm min-w-[200px]">
            <option value="">الكل</option>
            {Object.entries(OP_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">التصنيف</label>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
            className="block bg-white/5 border border-white/10 rounded-md px-2 h-9 text-sm min-w-[180px]">
            <option value="">الكل</option>
            {Object.entries(CLASS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {Object.entries(CLASS_META).map(([k, m]) => {
          const t = totals[k] ?? { cnt: 0, amt: 0 };
          return (
            <button key={k} onClick={() => setClassFilter(classFilter === k ? "" : k)}
              className={`text-right rounded-lg border p-2 ${m.cls} ${classFilter === k ? "ring-1 ring-white/30" : ""}`}>
              <div className="text-[11px] opacity-80">{m.label}</div>
              <div className="text-sm font-semibold mt-0.5">{t.cnt} عملية</div>
              <div className="text-[10px] font-mono opacity-80">{fmtSAR(t.amt)}</div>
            </button>
          );
        })}
      </div>

      {scan.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="animate-spin" size={14} /> جاري الفحص…</div>
      ) : scan.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          تعذّر تشغيل الفحص: {(scan.error as any)?.message ?? "خطأ غير معروف"}
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between text-[12px] border-b border-white/10 bg-white/5">
            <span className="text-muted-foreground">{rows.length} سجل معروض</span>
            <span className="font-mono">إجمالي المبلغ: {fmtSAR(rows.reduce((s, r) => s + Number(r.op_amount || 0), 0))}</span>
          </div>
          <div className="overflow-x-auto max-h-[65vh]">
            <table className="min-w-full text-[12px]">
              <thead className="bg-white/5 text-xs sticky top-0">
                <tr>
                  <th className="p-2 text-right w-6"></th>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">الطرف</th>
                  <th className="p-2 text-right">المبلغ</th>
                  <th className="p-2 text-right">القيد الحالي</th>
                  <th className="p-2 text-right">مبلغ القيد</th>
                  <th className="p-2 text-right">التصنيف</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">لا توجد سجلات</td></tr>
                )}
                {rows.map((r) => {
                  const id = `${r.op_kind}:${r.op_id}`;
                  const isOpen = expanded.has(id);
                  const meta = CLASS_META[r.classification] ?? CLASS_META.out_of_scope;
                  return (
                    <>
                      <tr key={id} className="border-t border-white/5 hover:bg-white/[0.03]">
                        <td className="p-2">
                          <button onClick={() => toggle(id)} className="p-1 rounded hover:bg-white/10">
                            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                        <td className="p-2 whitespace-nowrap">{r.op_date}</td>
                        <td className="p-2">{OP_KIND_LABEL[r.op_kind] ?? r.op_kind}</td>
                        <td className="p-2 max-w-[200px] truncate" title={r.counterparty ?? ""}>{r.counterparty || "—"}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{fmtSAR(Number(r.op_amount))}</td>
                        <td className="p-2 font-mono text-[11px]">{r.existing_je_number || "—"}</td>
                        <td className="p-2 font-mono whitespace-nowrap">{r.existing_total != null ? fmtSAR(Number(r.existing_total)) : "—"}</td>
                        <td className="p-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] ${meta.cls}`}>{meta.label}</span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-white/[0.02]">
                          <td colSpan={8} className="p-3">
                            {r.diff_reason && (
                              <div className="mb-2 text-[11px] text-amber-300">{r.diff_reason}</div>
                            )}
                            <div className="text-[11px] text-muted-foreground mb-1">
                              معرّف العملية: <span className="font-mono">{r.op_id}</span>
                              {r.provider_code && <> · بوابة: <span className="font-mono">{r.provider_code}</span></>}
                            </div>
                            <div className="rounded-lg border border-white/10 overflow-hidden">
                              <div className="bg-white/5 px-2 py-1 text-[11px] text-muted-foreground">
                                سطور القيد الحالي {r.existing_je_number ? `— ${r.existing_je_number}` : ""}
                              </div>
                              {Array.isArray(r.existing_lines) && r.existing_lines.length > 0 ? (
                                <table className="w-full text-[11px]">
                                  <thead className="text-muted-foreground bg-white/[0.03]">
                                    <tr>
                                      <th className="p-1.5 text-right">الحساب</th>
                                      <th className="p-1.5 text-right">مدين</th>
                                      <th className="p-1.5 text-right">دائن</th>
                                      <th className="p-1.5 text-right">الوصف</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.existing_lines.map((l: any, i: number) => (
                                      <tr key={i} className="border-t border-white/5">
                                        <td className="p-1.5">{l.account_code ? `${l.account_code} — ` : ""}{l.account_name || l.system_key || "—"}</td>
                                        <td className="p-1.5 font-mono">{Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : ""}</td>
                                        <td className="p-1.5 font-mono">{Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : ""}</td>
                                        <td className="p-1.5 text-muted-foreground truncate max-w-[300px]" title={l.description ?? ""}>{l.description || ""}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="p-3 text-center text-muted-foreground text-[11px]">
                                  {r.existing_je_id ? "لا توجد سطور" : "لا يوجد قيد لهذه العملية"}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        المرحلة الأولى: عرض فقط. لن يتم اعتماد أو تعديل أي قيد من هذه الصفحة. لوحة الاعتماد اليدوي ستضاف في المرحلة الثانية.
      </p>
    </div>
  );
}
