import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SAR } from "@/lib/finance/purchase-constants";
import { ChevronDown, ChevronRight, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/health")({
  ssr: false,
  component: FinanceHealthPage,
});

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const daysBetween = (a: string, b: string) =>
  Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000));

function FinanceHealthPage() {
  // --- Data ---
  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ["health_purchase_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices" as any)
        .select("id, internal_reference, supplier_id, total_amount, vat_amount, issue_date, status, supplier:finance_suppliers(name)")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const invoiceIds = invoices.map((i) => i.id);
  const { data: attachments = [] } = useQuery({
    queryKey: ["health_pi_attachments", invoiceIds.length],
    queryFn: async () => {
      if (!invoiceIds.length) return [];
      const { data } = await supabase
        .from("finance_attachments")
        .select("related_bigint_id")
        .eq("related_type", "purchase_invoice" as any)
        .in("related_bigint_id", invoiceIds);
      return (data ?? []) as any[];
    },
    enabled: invoiceIds.length > 0,
  });
  const attachedSet = useMemo(
    () => new Set(attachments.map((a) => Number(a.related_bigint_id))),
    [attachments]
  );

  const { data: expenses = [] } = useQuery({
    queryKey: ["health_expenses_linked"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_expenses" as any)
        .select("purchase_invoice_id, amount, deleted_at")
        .not("purchase_invoice_id", "is", null)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const paidByInvoice = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of expenses) {
      const id = Number(e.purchase_invoice_id);
      m.set(id, (m.get(id) ?? 0) + Number(e.amount || 0));
    }
    return m;
  }, [expenses]);

  const { data: settlements = [], isLoading: loadingSet } = useQuery({
    queryKey: ["health_unmatched_settlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_settlements" as any)
        .select("id, provider_id, settlement_reference, settlement_date, expected_net_amount, status, bank_income_id")
        .is("bank_income_id", null)
        .gt("expected_net_amount", 0)
        .order("settlement_date", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["health_providers"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_providers" as any).select("id, name");
      return (data ?? []) as any[];
    },
  });
  const providerName = (id: string | null) =>
    providers.find((p) => p.id === id)?.name ?? "—";

  // --- Detector 1: duplicates ---
  const duplicates = useMemo(() => {
    const active = invoices.filter(
      (i) => i.status !== "draft" && i.status !== "rejected" && i.supplier_id && i.issue_date
    );
    const byKey = new Map<string, any[]>();
    for (const r of active) {
      const k = `${r.supplier_id}|${Number(r.total_amount || 0).toFixed(2)}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(r);
    }
    const flagged: any[] = [];
    const seen = new Set<number>();
    for (const rows of byKey.values()) {
      if (rows.length < 2) continue;
      // find groups within 5 days
      const sorted = [...rows].sort((a, b) => a.issue_date.localeCompare(b.issue_date));
      for (let i = 0; i < sorted.length; i++) {
        const group = [sorted[i]];
        for (let j = i + 1; j < sorted.length; j++) {
          if (daysBetween(sorted[i].issue_date, sorted[j].issue_date) <= 5) group.push(sorted[j]);
        }
        if (group.length >= 2 && group.some((g) => !seen.has(g.id))) {
          for (const g of group) {
            if (!seen.has(g.id)) {
              seen.add(g.id);
              flagged.push(g);
            }
          }
        }
      }
    }
    return flagged;
  }, [invoices]);

  // --- Detector 3: approved w/ VAT missing attachment ---
  const missingAttach = useMemo(() => {
    const statuses = new Set(["approved", "paid", "partially_paid"]);
    return invoices.filter(
      (i) => statuses.has(i.status) && Number(i.vat_amount || 0) > 0 && !attachedSet.has(Number(i.id))
    );
  }, [invoices, attachedSet]);

  // --- Detector 4: invoice vs payments mismatch ---
  // Only flag real anomalies: overpayments (paid > total) OR fully-"paid" status
  // whose linked expenses still don't match the total. Partial payments and
  // invoices paid through other channels (provider wallet, notes...) are NOT
  // conflicts and must not be surfaced as data corruption.
  const mismatches = useMemo(() => {
    const out: any[] = [];
    for (const i of invoices) {
      const paid = paidByInvoice.get(Number(i.id)) ?? 0;
      if (paid <= 0) continue;
      const total = Number(i.total_amount || 0);
      const diff = paid - total;
      const overpaid = diff > 0.02;
      const underpaidButMarkedPaid = i.status === "paid" && diff < -0.02;
      if (overpaid || underpaidButMarkedPaid) {
        out.push({ ...i, paid_sum: paid, difference: diff });
      }
    }
    return out;
  }, [invoices, paidByInvoice]);

  const totalIssues = duplicates.length + settlements.length + missingAttach.length + mismatches.length;
  const anyLoading = loadingInv || loadingSet;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Aqua Haven · Data Health</div>
        <h2 className="text-base font-semibold mt-1">مركز فحص سلامة البيانات</h2>
        <p className="text-[11px] text-muted-foreground mt-1">
          فحوصات للقراءة فقط تكشف التكرار، التسويات غير المرتبطة، المرفقات الناقصة، وتعارض الدفعات.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {totalIssues > 0 ? (
            <AlertTriangle className="text-amber-300" size={20} />
          ) : (
            <ShieldCheck className="text-emerald-400" size={20} />
          )}
          <div>
            <div className="text-[12px] text-muted-foreground">إجمالي الملاحظات</div>
            <div className="text-lg font-semibold">
              {anyLoading ? <Loader2 className="animate-spin inline" size={18} /> : totalIssues}
            </div>
          </div>
        </div>
        <div className="hidden md:flex gap-2 text-[11px]">
          <Chip label="مكررة" n={duplicates.length} />
          <Chip label="تسويات" n={settlements.length} />
          <Chip label="بدون مرفق" n={missingAttach.length} />
          <Chip label="تعارض دفعات" n={mismatches.length} />
        </div>
      </div>

      <DetectorCard
        title="فواتير مكررة محتملة"
        subtitle="نفس المورد ونفس الإجمالي خلال 5 أيام"
        count={duplicates.length}
      >
        <table className="w-full text-[12px] min-w-[720px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">المرجع</th>
              <th className="text-right p-2">المورد</th>
              <th className="text-right p-2">الإجمالي</th>
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {duplicates.map((r) => (
              <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2">
                  <Link to="/admin/finance/purchase-invoices/$id" params={{ id: String(r.id) }} className="text-gold hover:underline">
                    {r.internal_reference}
                  </Link>
                </td>
                <td className="p-2">{r.supplier?.name ?? "—"}</td>
                <td className="p-2">{SAR(Number(r.total_amount || 0))}</td>
                <td className="p-2">{fmtDate(r.issue_date)}</td>
                <td className="p-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetectorCard>

      <DetectorCard
        title="تسويات بدون حوالة بنكية"
        subtitle="تسويات بوابات دفع لم تُربط بحوالة واردة"
        count={settlements.length}
      >
        <table className="w-full text-[12px] min-w-[720px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">البوابة</th>
              <th className="text-right p-2">مرجع التسوية</th>
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الصافي المتوقع</th>
              <th className="text-right p-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2">{providerName(s.provider_id)}</td>
                <td className="p-2">{s.settlement_reference ?? "—"}</td>
                <td className="p-2">{fmtDate(s.settlement_date)}</td>
                <td className="p-2">{SAR(Number(s.expected_net_amount || 0))}</td>
                <td className="p-2">{s.status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetectorCard>

      <DetectorCard
        title="فواتير معتمدة بدون مرفق"
        subtitle="فواتير معتمدة/مدفوعة تحمل ضريبة ولا يوجد مرفق ضريبي — استرداد الضريبة في خطر"
        count={missingAttach.length}
      >
        <table className="w-full text-[12px] min-w-[720px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">المرجع</th>
              <th className="text-right p-2">المورد</th>
              <th className="text-right p-2">الإجمالي</th>
              <th className="text-right p-2">الضريبة</th>
              <th className="text-right p-2">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {missingAttach.map((r) => (
              <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2">
                  <Link to="/admin/finance/purchase-invoices/$id" params={{ id: String(r.id) }} className="text-gold hover:underline">
                    {r.internal_reference}
                  </Link>
                </td>
                <td className="p-2">{r.supplier?.name ?? "—"}</td>
                <td className="p-2">{SAR(Number(r.total_amount || 0))}</td>
                <td className="p-2">{SAR(Number(r.vat_amount || 0))}</td>
                <td className="p-2">{fmtDate(r.issue_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetectorCard>

      <DetectorCard
        title="تعارض فاتورة / دفعة"
        subtitle="مجموع الدفعات المرتبطة يختلف عن إجمالي الفاتورة بأكثر من 0.02"
        count={mismatches.length}
      >
        <table className="w-full text-[12px] min-w-[820px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">المرجع</th>
              <th className="text-right p-2">المورد</th>
              <th className="text-right p-2">الإجمالي</th>
              <th className="text-right p-2">مجموع الدفعات</th>
              <th className="text-right p-2">الفرق</th>
            </tr>
          </thead>
          <tbody>
            {mismatches.map((r) => (
              <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2">
                  <Link to="/admin/finance/purchase-invoices/$id" params={{ id: String(r.id) }} className="text-gold hover:underline">
                    {r.internal_reference}
                  </Link>
                </td>
                <td className="p-2">{r.supplier?.name ?? "—"}</td>
                <td className="p-2">{SAR(Number(r.total_amount || 0))}</td>
                <td className="p-2">{SAR(r.paid_sum)}</td>
                <td className={`p-2 ${r.difference > 0 ? "text-amber-300" : "text-red-300"}`}>
                  {r.difference > 0 ? "+" : ""}
                  {SAR(r.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetectorCard>
    </div>
  );
}

function Chip({ label, n }: { label: string; n: number }) {
  const tone = n > 0 ? "bg-amber-400/15 text-amber-200 border-amber-400/30" : "bg-emerald-400/10 text-emerald-300 border-emerald-400/20";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${tone}`}>
      {label}: <b>{n}</b>
    </span>
  );
}

function DetectorCard({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(count > 0);
  const severe = count > 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 text-right">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <div>
            <div className="text-[13px] font-semibold">{title}</div>
            {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            severe
              ? "bg-red-500/15 text-red-300 border-red-500/40"
              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
          }
        >
          {count}
        </Badge>
      </button>
      {open && (
        <div className="border-t border-white/10 overflow-x-auto">
          {count === 0 ? (
            <div className="p-4 text-[12px] text-muted-foreground text-center">لا توجد ملاحظات ✓</div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
