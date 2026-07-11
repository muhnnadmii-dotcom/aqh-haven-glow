import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/settlements-review")({
  ssr: false,
  component: SettlementsReviewPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", imported: "مستوردة", under_review: "قيد المراجعة",
  matched: "مطابقة", partially_matched: "مطابقة جزئية",
  awaiting_payout: "بانتظار التحويل", paid: "محوّلة", cancelled: "ملغاة",
};

function SettlementsReviewPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([
      supabase.from("payment_settlements" as any).select("*").order("settlement_date", { ascending: false }),
      supabase.from("payment_providers" as any).select("*"),
    ]);
    if (s.error) toast.error(s.error.message); else setRows(s.data ?? []);
    setProviders(p.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const needsReview = rows.filter((r) => {
    const tol = providers.find((p) => p.id === r.provider_id)?.rounding_tolerance ?? 0.05;
    if (r.status === "under_review" || r.status === "partially_matched") return true;
    if (r.actual_bank_amount != null && Math.abs(Number(r.difference_amount)) > Number(tol)) return true;
    if (r.status === "imported" && r.actual_bank_amount == null) return true;
    return false;
  });

  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? "—";
  const reason = (r: any) => {
    const tol = providers.find((p) => p.id === r.provider_id)?.rounding_tolerance ?? 0.05;
    if (r.actual_bank_amount != null && Math.abs(Number(r.difference_amount)) > Number(tol)) {
      return `فرق غير مقبول: ${Number(r.difference_amount).toFixed(2)} (الهامش ${tol})`;
    }
    if (r.status === "imported" && r.actual_bank_amount == null) return "لم يتم ربط الحوالة البنكية بعد";
    if (r.status === "partially_matched") return "مطابقة جزئية";
    return "قيد المراجعة";
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">تسويات تحتاج مراجعة</h2>
        <p className="text-[11px] text-muted-foreground mt-1">قائمة التسويات التي فيها فرق يتجاوز هامش التقريب أو لم يتم مطابقتها مع الحوالة البنكية.</p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground text-[12px] py-6">جارٍ التحميل…</div>
      ) : needsReview.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-[12px] text-muted-foreground">لا توجد تسويات تحتاج مراجعة</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-amber-500/30 bg-amber-500/5">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-3 py-2">التاريخ</th>
                <th className="text-start px-3 py-2">البوابة</th>
                <th className="text-start px-3 py-2">المرجع</th>
                <th className="text-start px-3 py-2">صافي متوقع</th>
                <th className="text-start px-3 py-2">فعلي</th>
                <th className="text-start px-3 py-2">الفرق</th>
                <th className="text-start px-3 py-2">الحالة</th>
                <th className="text-start px-3 py-2">السبب</th>
              </tr>
            </thead>
            <tbody>
              {needsReview.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{r.settlement_date}</td>
                  <td className="px-3 py-2">{providerName(r.provider_id)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.settlement_reference ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{Number(r.expected_net_amount).toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.actual_bank_amount != null ? Number(r.actual_bank_amount).toFixed(2) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-red-400">{Number(r.difference_amount).toFixed(2)}</td>
                  <td className="px-3 py-2">{STATUS_LABEL[r.status]}</td>
                  <td className="px-3 py-2 text-amber-400 inline-flex items-center gap-1"><AlertTriangle size={12} /> {reason(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
