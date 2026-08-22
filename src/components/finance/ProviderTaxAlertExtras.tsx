import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Loader2, FilePlus2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createProviderFeeInvoiceDraft,
  type ProviderTaxAlertRow,
} from "@/lib/finance/provider-tax-invoices";

const n2 = (v: number) => Number(v ?? 0).toFixed(2);

/** زر إنشاء مسودة فاتورة رسوم شهرية للبوابة (مسودة فقط) */
export function ProviderFeeDraftButton({ row }: { row: ProviderTaxAlertRow }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (row.alert_status !== "missing_invoice" || row.alert_kind !== "monthly_fees") return null;

  const run = async () => {
    setLoading(true);
    try {
      const res = await createProviderFeeInvoiceDraft(row.provider_id, row.fee_month, false);
      const id = res.invoice_id != null ? String(res.invoice_id) : "";
      if (!id) throw new Error(res.message || "تعذّر إنشاء المسودة");
      toast[res.created ? "success" : "info"](
        res.created
          ? "تم إنشاء مسودة الفاتورة من التسويات"
          : res.message || "الفاتورة موجودة مسبقًا وتم فتحها",
      );
      navigate({ to: "/admin/finance/purchase-invoices/$id", params: { id } });
    } catch (e: any) {
      toast.error(e?.message || "تعذّر إنشاء المسودة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={run}
        className="h-8 w-full sm:w-auto gap-2 text-xs"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />}
        إنشاء فاتورة مسودة
      </Button>
      <div className="text-[10px] text-muted-foreground leading-relaxed">
        المسودة مبنية من التسويات فقط: لا اعتماد ولا دفع تلقائي. أرفق ملف PDF الرسمي وراجع رقم
        وتاريخ الفاتورة قبل اعتمادها.
      </div>
    </div>
  );
}

/** شرح سبب/حل تنبيه عدم المطابقة + رابط فتح الفاتورة */
export function ProviderUnreconciledDetails({ row }: { row: ProviderTaxAlertRow }) {
  if (row.alert_status !== "unreconciled") return null;
  const matched = Number(row.invoice_total ?? 0) - Number(row.unreconciled_amount ?? 0);
  const invoiceId = row.invoice_ids?.[0] ? String(row.invoice_ids[0]) : null;

  return (
    <div className="mt-2 space-y-1 rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] leading-relaxed">
      <div className="text-muted-foreground">
        السبب: إجمالي الفاتورة <span className="tabular-nums">{n2(row.invoice_total)}</span> ·
        المطابق مع التسويات <span className="tabular-nums">{n2(matched)}</span> · الفرق{" "}
        <span className="tabular-nums text-amber-300">{n2(row.unreconciled_amount)}</span>
      </div>
      <div className="text-muted-foreground">
        الحل: افتح الفاتورة وراجع روابط التسويات أو صحّح المطابقة. لا تغيّر إجمالي الفاتورة الرسمية
        لتصفير الفرق.
      </div>
      {invoiceId && (
        <Link
          to="/admin/finance/purchase-invoices/$id"
          params={{ id: invoiceId }}
          className="inline-flex items-center gap-1 text-amber-300 hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> فتح الفاتورة
        </Link>
      )}
    </div>
  );
}
