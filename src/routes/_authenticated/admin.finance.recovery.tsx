import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { SAR } from "@/lib/finance/purchase-constants";

export const Route = createFileRoute("/_authenticated/admin/finance/recovery")({
  ssr: false,
  component: RecoveryPage,
});

function RecoveryPage() {
  const [showClosed, setShowClosed] = useState(false);

  const { data: openPeriods = [] } = useQuery({
    queryKey: ["tax_periods_open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_periods" as any)
        .select("start_date, end_date")
        .eq("status", "open");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["recovery_candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices" as any)
        .select(
          "id, internal_reference, supplier_id, issue_date, total_amount, vat_amount, vat_deductibility, status, supplier:finance_suppliers(name)"
        )
        .gt("vat_amount", 0)
        .or("deductible_vat_amount.is.null,deductible_vat_amount.eq.0")
        .order("vat_amount", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const invoiceIds = invoices.map((i) => i.id);
  const { data: attachments = [] } = useQuery({
    queryKey: ["recovery_attachments", invoiceIds.length],
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
  const hasAttachment = (id: number) =>
    attachments.some((a) => Number(a.related_bigint_id) === id);

  const isInOpenPeriod = useMemo(() => {
    return (dateStr: string | null) => {
      if (!dateStr) return false;
      return openPeriods.some(
        (p: any) => dateStr >= p.start_date && dateStr <= p.end_date
      );
    };
  }, [openPeriods]);

  const groupA = invoices.filter((r) => isInOpenPeriod(r.issue_date));
  const groupB = invoices.filter((r) => !isInOpenPeriod(r.issue_date));

  const sumA = groupA.reduce((a, r) => a + Number(r.vat_amount ?? 0), 0);
  const sumB = groupB.reduce((a, r) => a + Number(r.vat_amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">فرص استرداد الضريبة</h1>
        <p className="text-[12px] text-muted-foreground mt-1 flex items-center gap-1.5">
          <Info size={13} className="text-gold" />
          استرداد الضريبة يتطلب فاتورة ضريبية مرفقة + الفاتورة داخل فترة ضريبية مفتوحة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="text-[11px] text-emerald-300/80">ضريبة يمكن استردادها الآن</div>
          <div className="text-2xl font-semibold mt-1 font-mono text-emerald-300">
            {SAR(sumA)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {groupA.length} فاتورة داخل فترة مفتوحة
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] text-muted-foreground">ضريبة خارج الفترة</div>
          <div className="text-2xl font-semibold mt-1 font-mono text-muted-foreground">
            {SAR(sumB)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {groupB.length} فاتورة في فترة مقفلة أو بدون فترة
          </div>
        </div>
      </div>

      <Section title="قابلة للاسترداد الآن" tone="ok">
        <CandidatesTable
          rows={groupA}
          isLoading={isLoading}
          hasAttachment={hasAttachment}
        />
      </Section>

      <div>
        <button
          onClick={() => setShowClosed((s) => !s)}
          className="text-[12px] text-muted-foreground hover:text-foreground underline"
        >
          {showClosed ? "إخفاء" : "عرض"} الفواتير خارج الفترة ({groupB.length})
        </button>
        {showClosed && (
          <div className="mt-3">
            <Section title="خارج الفترة (مقفلة)" tone="muted">
              <CandidatesTable
                rows={groupB}
                isLoading={isLoading}
                hasAttachment={hasAttachment}
              />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "ok" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div
        className={`text-[12px] font-semibold ${
          tone === "ok" ? "text-emerald-300" : "text-muted-foreground"
        }`}
      >
        {title}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

function CandidatesTable({
  rows,
  isLoading,
  hasAttachment,
}: {
  rows: any[];
  isLoading: boolean;
  hasAttachment: (id: number) => boolean;
}) {
  return (
    <table className="w-full text-[12px]">
      <thead className="bg-white/5 text-muted-foreground">
        <tr>
          <th className="text-start px-3 py-2">المرجع</th>
          <th className="text-start px-3 py-2">المورد</th>
          <th className="text-start px-3 py-2">التاريخ</th>
          <th className="text-start px-3 py-2">الإجمالي</th>
          <th className="text-start px-3 py-2">الضريبة</th>
          <th className="text-start px-3 py-2">المرفق</th>
          <th className="text-start px-3 py-2">السبب</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr>
            <td colSpan={7} className="text-center py-8 text-muted-foreground">
              <Loader2 className="animate-spin inline" size={16} />
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="text-center py-8 text-muted-foreground">
              لا توجد فواتير
            </td>
          </tr>
        ) : (
          rows.map((r) => {
            const att = hasAttachment(r.id);
            const reason = !att
              ? "بدون مرفق ضريبي"
              : "معلّمة غير قابلة للخصم";
            return (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-2">
                  <Link
                    to="/admin/finance/purchase-invoices/$id"
                    params={{ id: String(r.id) }}
                    className="text-gold hover:underline font-mono"
                  >
                    {r.internal_reference ?? `#${r.id}`}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {r.supplier?.name ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono">{r.issue_date ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{SAR(r.total_amount ?? 0)}</td>
                <td className="px-3 py-2 font-mono">{SAR(r.vat_amount ?? 0)}</td>
                <td className="px-3 py-2">
                  {att ? (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      مرفق
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                      غير مرفق
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{reason}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
