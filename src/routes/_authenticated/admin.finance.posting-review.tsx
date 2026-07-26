import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { fmtSAR } from "@/lib/finance/constants";

export const Route = createFileRoute("/_authenticated/admin/finance/posting-review")({
  ssr: false,
  component: PostingReviewPage,
});

type Line = { account_id: string | null; account_code?: string | null; account_name?: string | null; system_key?: string | null; debit: number; credit: number; description?: string | null; line_order?: number };
type ScanRow = {
  op_kind: string; op_id: string; op_date: string; op_amount: number;
  counterparty: string | null; provider_code: string | null;
  expected_source_type: string; expected_source_id: string;
  expected_total: number; expected_lines: Line[] | null;
  existing_je_id: string | null; existing_je_number: string | null;
  existing_status: string | null; existing_entry_date: string | null;
  existing_total: number | null; existing_lines: Line[];
  classification: "correct" | "draft_pending" | "missing" | "mismatch" | "duplicate" | "blocked_configuration";
  diff_reason: string | null; blocked_reason: string | null;
  total_count: number;
};
type Readiness = { slot: string; label: string; category: string; present: boolean; detail: string | null };

const OP_KIND_LABEL: Record<string, string> = {
  sales_invoice_approval: "اعتماد فاتورة مبيعات",
  purchase_invoice_approval: "اعتماد فاتورة مشتريات",
  purchase_invoice_payment: "دفع مورد (من حساب)",
  purchase_invoice_payment_wallet: "دفع مورد (من محفظة/وسيط)",
  owner_withdrawal: "سحب/تسوية المالك",
  owner_contribution: "مساهمة مالك",
  owner_reimbursement: "تعويض المالك",
  internal_transfer_out: "تحويل داخلي — صادر",
  sales_invoice_collection_direct: "تحصيل فاتورة (مباشر)",
  sales_invoice_collection_gateway: "تحصيل فاتورة (بوابة — مقترح)",
  payment_settlement_payout: "تحويل تسوية للبنك",
};

const CLASS_META: Record<string, { label: string; cls: string }> = {
  correct:               { label: "مطابق",           cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  draft_pending:         { label: "مسودة مطابقة",     cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  missing:               { label: "لا يوجد قيد",     cls: "bg-red-500/10 text-red-300 border-red-500/30" },
  mismatch:              { label: "فرق/اختلاف",      cls: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
  duplicate:             { label: "قيود مكررة",      cls: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30" },
  blocked_configuration: { label: "إعداد ناقص",      cls: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
};

const PAGE_SIZE = 100;

function LineCell({ l }: { l: Line }) {
  return (
    <div className="text-[11px]">
      <div className="text-muted-foreground">
        {l.account_code ? `${l.account_code} — ` : ""}{l.account_name || l.system_key || (l.account_id ? l.account_id.slice(0,8) : "—")}
      </div>
      <div className="font-mono">
        {Number(l.debit) > 0 && <span>مدين {Number(l.debit).toFixed(2)}</span>}
        {Number(l.credit) > 0 && <span>دائن {Number(l.credit).toFixed(2)}</span>}
      </div>
    </div>
  );
}

function normSig(lines: Line[] | null | undefined) {
  return (lines ?? [])
    .map(l => `${l.account_id ?? "∅"}|${Number(l.debit || 0).toFixed(2)}|${Number(l.credit || 0).toFixed(2)}`)
    .sort()
    .join("#");
}

function PostingReviewPage() {
  const [from, setFrom] = useState("2026-01-01");
  const today = new Date();
  const [to, setTo] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  const [kindFilter, setKindFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showReadiness, setShowReadiness] = useState(true);

  const readiness = useQuery({
    queryKey: ["finance_posting_readiness"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_posting_account_readiness" as any);
      if (error) throw error;
      return (data ?? []) as Readiness[];
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

  const scan = useQuery({
    queryKey: ["finance_posting_scan", from, to, kindFilter, classFilter, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_posting_scan" as any, {
        p_from: from, p_to: to,
        p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE,
        p_kind: kindFilter || null, p_class: classFilter || null,
      });
      if (error) throw error;
      return (data ?? []) as ScanRow[];
    },
  });

  const totalCount = scan.data?.[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(totalCount) / PAGE_SIZE));

  const classTotals = useMemo(() => {
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

  const readinessByCategory = useMemo(() => {
    const g: Record<string, Readiness[]> = {};
    for (const r of readiness.data ?? []) {
      (g[r.category] ??= []).push(r);
    }
    return g;
  }, [readiness.data]);

  const readinessMissing = (readiness.data ?? []).filter(r => !r.present && r.category !== "provider_mapping" || (!r.present && r.category === "provider_mapping" && !r.slot.startsWith("provider_wallet"))).length;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">مراجعة الترحيل المحاسبي</h2>
          <p className="text-xs text-muted-foreground mt-1">
            عرض للقراءة فقط. يبني القيد المتوقع لكل عملية من قواعد الترحيل الحالية ويقارنه بالقيد الموجود. لا اعتماد ولا تعديل من هذه الصفحة.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { scan.refetch(); summary.refetch(); readiness.refetch(); }} className="gap-1">
          <RefreshCw size={14} /> تحديث
        </Button>
      </div>

      {/* Account readiness */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <button onClick={() => setShowReadiness(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            {readinessMissing === 0 ? <CheckCircle2 size={14} className="text-emerald-400" /> : <AlertTriangle size={14} className="text-amber-400" />}
            <span className="font-semibold">جاهزية الحسابات</span>
            <span className="text-[11px] text-muted-foreground">
              {readinessMissing === 0 ? "كل الحسابات المطلوبة موجودة" : `${readinessMissing} حساب/ربط ناقص`}
            </span>
          </div>
          {showReadiness ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showReadiness && (
          <div className="border-t border-white/10 p-3 grid gap-3 md:grid-cols-3">
            {["chart_account", "provider_mapping", "finance_account"].map(cat => (
              <div key={cat} className="space-y-1">
                <div className="text-[11px] text-muted-foreground font-semibold">
                  {cat === "chart_account" ? "دليل الحسابات" : cat === "provider_mapping" ? "ربط البوابات" : "الحسابات المالية"}
                </div>
                {(readinessByCategory[cat] ?? []).map(r => (
                  <div key={r.slot} className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-[11px] ${r.present ? "border-white/5 bg-white/[0.02]" : "border-amber-500/30 bg-amber-500/5"}`}>
                    <span className="truncate">{r.label}</span>
                    <span className={`font-mono text-[10px] ${r.present ? "text-emerald-300" : "text-amber-300"}`}>
                      {r.present ? "✓" : "✗"} {r.detail}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-end">
        <div><label className="text-xs text-muted-foreground">من</label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} /></div>
        <div><label className="text-xs text-muted-foreground">إلى</label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} /></div>
        <div>
          <label className="text-xs text-muted-foreground">نوع العملية</label>
          <select value={kindFilter} onChange={(e) => { setKindFilter(e.target.value); setPage(0); }}
            className="block bg-white/5 border border-white/10 rounded-md px-2 h-9 text-sm min-w-[220px]">
            <option value="">الكل</option>
            {Object.entries(OP_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">التصنيف</label>
          <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(0); }}
            className="block bg-white/5 border border-white/10 rounded-md px-2 h-9 text-sm min-w-[180px]">
            <option value="">الكل</option>
            {Object.entries(CLASS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {Object.entries(CLASS_META).map(([k, m]) => {
          const t = classTotals[k] ?? { cnt: 0, amt: 0 };
          return (
            <button key={k} onClick={() => { setClassFilter(classFilter === k ? "" : k); setPage(0); }}
              className={`text-right rounded-lg border p-2 ${m.cls} ${classFilter === k ? "ring-1 ring-white/40" : ""}`}>
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
        <>
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between text-[12px] border-b border-white/10 bg-white/5">
              <span className="text-muted-foreground">
                عرض {(scan.data ?? []).length} من {Number(totalCount)} — صفحة {page + 1} / {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30"><ChevronRight size={14} /></button>
                <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={14} /></button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="min-w-full text-[12px]">
                <thead className="bg-white/5 text-xs sticky top-0">
                  <tr>
                    <th className="p-2 text-right w-6"></th>
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-right">النوع</th>
                    <th className="p-2 text-right">الطرف</th>
                    <th className="p-2 text-right">المبلغ</th>
                    <th className="p-2 text-right">القيد الحالي</th>
                    <th className="p-2 text-right">تاريخ القيد</th>
                    <th className="p-2 text-right">التصنيف</th>
                  </tr>
                </thead>
                <tbody>
                  {(scan.data ?? []).length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد سجلات</td></tr>
                  )}
                  {(scan.data ?? []).map((r) => {
                    const id = `${r.op_kind}:${r.op_id}`;
                    const isOpen = expanded.has(id);
                    const meta = CLASS_META[r.classification] ?? CLASS_META.blocked_configuration;
                    const sigE = normSig(r.existing_lines);
                    const sigX = normSig(r.expected_lines);
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
                          <td className="p-2 whitespace-nowrap text-[11px]">{r.existing_entry_date || "—"}</td>
                          <td className="p-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] ${meta.cls}`}>{meta.label}</span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-white/[0.02]">
                            <td colSpan={8} className="p-3">
                              {r.diff_reason && (
                                <div className="mb-2 flex items-center gap-2 text-[11px] text-amber-300">
                                  <AlertTriangle size={12} /> {r.diff_reason}
                                </div>
                              )}
                              <div className="text-[11px] text-muted-foreground mb-2">
                                معرّف العملية: <span className="font-mono">{r.op_id}</span>
                                {" · "}مصدر متوقع: <span className="font-mono">{r.expected_source_type}/{r.expected_source_id}</span>
                                {r.provider_code && <> · بوابة: <span className="font-mono">{r.provider_code}</span></>}
                              </div>
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="rounded-lg border border-emerald-500/20 overflow-hidden">
                                  <div className="bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">القيد المقترح (وفق قواعد الترحيل)</div>
                                  {r.expected_lines && r.expected_lines.length ? (
                                    <table className="w-full text-[11px]">
                                      <tbody>
                                        {r.expected_lines.map((l, i) => (
                                          <tr key={i} className="border-t border-white/5">
                                            <td className="p-1.5"><LineCell l={l} /></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="p-3 text-center text-muted-foreground text-[11px]">
                                      {r.blocked_reason ?? "لا يمكن اشتقاق القيد"}
                                    </div>
                                  )}
                                </div>
                                <div className={`rounded-lg border overflow-hidden ${sigE === sigX && sigE ? "border-emerald-500/20" : "border-orange-500/20"}`}>
                                  <div className={`px-2 py-1 text-[11px] ${sigE === sigX && sigE ? "bg-emerald-500/10 text-emerald-300" : "bg-orange-500/10 text-orange-300"}`}>
                                    القيد الحالي {r.existing_je_number ? `— ${r.existing_je_number}` : ""} ({r.existing_status || "—"})
                                  </div>
                                  {r.existing_lines && r.existing_lines.length ? (
                                    <table className="w-full text-[11px]">
                                      <tbody>
                                        {r.existing_lines.map((l, i) => (
                                          <tr key={i} className="border-t border-white/5">
                                            <td className="p-1.5"><LineCell l={l} /></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="p-3 text-center text-muted-foreground text-[11px]">
                                      {r.existing_je_id ? "لا توجد سطور" : (
                                        <span className="inline-flex items-center gap-1"><XCircle size={12}/> لا يوجد قيد</span>
                                      )}
                                    </div>
                                  )}
                                </div>
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
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        المرحلة الأولى: قراءة وتشخيص فقط. أي اعتماد أو تصحيح للقيود سيتم لاحقًا من واجهة الاعتماد اليدوي في المرحلة الثانية.
      </p>
    </div>
  );
}
