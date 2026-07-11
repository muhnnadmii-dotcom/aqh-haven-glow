import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { fmtSAR } from "@/lib/finance/constants";

export type AccountingDrillSpec = {
  title: string;
  from: string;
  to: string;
  kind:
    | "sales_invoices"
    | "purchase_invoices"
    | "journal_by_type" // account_type
    | "journal_by_system_key"
    | "journal_by_system_keys";
  accountType?: "revenue" | "expense" | "asset" | "liability" | "equity";
  systemKey?: string;
  systemKeys?: string[];
  asOfMode?: boolean; // for balances: use <= to (ignore from)
};

export function AccountingRowsDrawer({ spec, onClose }: { spec: AccountingDrillSpec; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (spec.kind === "sales_invoices") {
          const { data } = await supabase
            .from("sales_invoices")
            .select("id, invoice_number, issue_date, customer_id, taxable_amount, discount_amount, vat_amount, total_amount, status")
            .in("status", ["approved", "partially_paid", "paid"])
            .gte("issue_date", spec.from).lte("issue_date", spec.to)
            .order("issue_date", { ascending: false });
          if (!alive) return;
          setRows(data ?? []);
          setTotal((data ?? []).reduce((s, r: any) => s + Number(r.total_amount || 0), 0));
        } else if (spec.kind === "purchase_invoices") {
          const { data } = await supabase
            .from("purchase_invoices")
            .select("id, internal_reference, supplier_invoice_number, issue_date, supplier_id, taxable_amount, vat_amount, deductible_vat_amount, total_amount, status")
            .in("status", ["approved", "partially_paid", "paid"])
            .gte("issue_date", spec.from).lte("issue_date", spec.to)
            .order("issue_date", { ascending: false });
          if (!alive) return;
          setRows(data ?? []);
          setTotal((data ?? []).reduce((s, r: any) => s + Number(r.total_amount || 0), 0));
        } else {
          // Journal-line based
          let accountIds: string[] = [];
          if (spec.kind === "journal_by_system_key" && spec.systemKey) {
            const { data } = await supabase.from("chart_of_accounts").select("id").eq("system_key", spec.systemKey);
            accountIds = (data ?? []).map((a: any) => a.id);
          } else if (spec.kind === "journal_by_system_keys" && spec.systemKeys?.length) {
            const { data } = await supabase.from("chart_of_accounts").select("id").in("system_key", spec.systemKeys);
            accountIds = (data ?? []).map((a: any) => a.id);
          } else if (spec.kind === "journal_by_type" && spec.accountType) {
            const { data } = await supabase.from("chart_of_accounts").select("id, system_key").eq("account_type", spec.accountType);
            const excludeKeys = spec.accountType === "expense" ? ["cogs", "owner_drawings"] : [];
            accountIds = (data ?? [])
              .filter((a: any) => !excludeKeys.includes(a.system_key))
              .map((a: any) => a.id);
          }
          if (accountIds.length === 0) {
            setRows([]); setTotal(0);
          } else {
            let q = supabase
              .from("journal_entry_lines")
              .select("id, debit, credit, description, journal_entry:journal_entries!inner(id, entry_number, entry_date, status, description)")
              .in("account_id", accountIds)
              .eq("journal_entry.status", "posted")
              .lte("journal_entry.entry_date", spec.to)
              .order("id", { ascending: false })
              .limit(500);
            if (!spec.asOfMode) q = q.gte("journal_entry.entry_date", spec.from);
            const { data } = await q;
            if (!alive) return;
            const list = data ?? [];
            setRows(list);
            const t = list.reduce((s: number, r: any) => s + Number(r.debit || 0) - Number(r.credit || 0), 0);
            setTotal(spec.accountType === "revenue" || spec.accountType === "liability" || spec.accountType === "equity" ? -t : t);
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [spec]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60" onClick={onClose}>
      <div className="w-full sm:w-[560px] bg-background border-s border-white/10 h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-white/10 p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{spec.title}</div>
            <div className="text-[11px] text-muted-foreground">
              {spec.asOfMode ? `حتى ${spec.to}` : `${spec.from} → ${spec.to}`} — {rows.length} سجل
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={16} /></button>
        </div>

        <div className="p-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 mb-3">
            <div className="text-[11px] text-muted-foreground">الإجمالي</div>
            <div className="text-lg font-semibold font-mono">{fmtSAR(total)} <span className="text-[10px] text-muted-foreground">ر.س</span></div>
          </div>

          {loading ? (
            <div className="text-center text-xs text-muted-foreground py-6">جاري التحميل…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">لا توجد سجلات في الفترة</div>
          ) : spec.kind === "sales_invoices" ? (
            <div className="space-y-2">
              {rows.map((r: any) => (
                <Link key={r.id} to="/admin/finance/sales-invoices/$id" params={{ id: String(r.id) }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2 hover:bg-white/10">
                  <div className="min-w-0">
                    <div className="text-[12px] truncate">{r.invoice_number}</div>
                    <div className="text-[10px] text-muted-foreground">{r.issue_date}</div>
                  </div>
                  <div className="text-left font-mono text-[12px]">{fmtSAR(Number(r.total_amount))}</div>
                </Link>
              ))}
            </div>
          ) : spec.kind === "purchase_invoices" ? (
            <div className="space-y-2">
              {rows.map((r: any) => (
                <Link key={r.id} to="/admin/finance/purchase-invoices/$id" params={{ id: String(r.id) }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2 hover:bg-white/10">
                  <div className="min-w-0">
                    <div className="text-[12px] truncate">{r.internal_reference} <span className="text-muted-foreground">— {r.supplier_invoice_number || "—"}</span></div>
                    <div className="text-[10px] text-muted-foreground">{r.issue_date}</div>
                  </div>
                  <div className="text-left font-mono text-[12px]">{fmtSAR(Number(r.total_amount))}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r: any) => {
                const je = r.journal_entry;
                const amount = Number(r.debit || 0) - Number(r.credit || 0);
                return (
                  <Link key={r.id} to="/admin/finance/journal-entries"
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2 hover:bg-white/10">
                    <div className="min-w-0">
                      <div className="text-[12px] truncate">{je?.entry_number} — {r.description || je?.description || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{je?.entry_date}</div>
                    </div>
                    <div className={`text-left font-mono text-[12px] ${amount >= 0 ? "" : "text-red-300"}`}>{fmtSAR(amount)}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
