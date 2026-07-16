import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/provider-fee-invoices")({
  ssr: false,
  component: ProviderFeeInvoicesPage,
});

const VAT_DOC_LABEL: Record<string, string> = {
  valid: "مستند سليم",
  missing: "مفقود",
  invalid_buyer_tax_data: "بيانات المشتري ناقصة",
  pending_review: "بانتظار المراجعة",
};

function fmt(n: any) { return Number(n ?? 0).toFixed(2); }

function ProviderFeeInvoicesPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filterProvider, setFilterProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase.from("payment_providers" as any).select("*");
    setProviders(p ?? []);
    const { data: inv, error } = await supabase
      .from("purchase_invoices" as any)
      .select("*")
      .not("payment_provider_id", "is", null)
      .order("issue_date", { ascending: false });
    if (error) toast.error(error.message);
    else setInvoices(inv ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const providerById = (id: string) => providers.find((p) => p.id === id);
  const filtered = invoices.filter((inv) => !filterProvider || inv.payment_provider_id === filterProvider);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">فواتير رسوم الوسطاء</h2>
        <p className="text-[11px] text-muted-foreground mt-1">
          فواتير المشتريات المرتبطة ببوابة دفع (سلة، تابي، تمارا). اربطها بالتسويات لتغطية الرسوم دون تكرار.
        </p>
        <p className="text-[11px] text-amber-300/80 mt-1">
          ملاحظة: <b>مطابقة الرسوم بالتسويات</b> (الأعمدة "مطابق/غير مطابق") تعكس التغطية المحاسبية للرسوم فقط، وليست دليلًا على أن الفاتورة مدفوعة. <b>مصدر السداد الفعلي</b> يظهر في عمود <b>حالة الفاتورة</b> و<b>المدفوع من رصيد البوابة</b> أدناه.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل البوابات</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="text-[11px] text-muted-foreground">لتعيين فاتورة كفاتورة رسوم بوابة: افتح الفاتورة وحدد "بوابة الدفع".</div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground text-[12px] py-6">جارٍ التحميل…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-[12px] text-muted-foreground">
          لا توجد فواتير رسوم بعد. عيّن حقل "بوابة الدفع" على فاتورة مشتريات لتظهر هنا.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-3 py-2">التاريخ</th>
                <th className="text-start px-3 py-2">المرجع</th>
                <th className="text-start px-3 py-2">البوابة</th>
                <th className="text-start px-3 py-2">فترة الرسوم</th>
                <th className="text-end px-3 py-2">الرسوم</th>
                <th className="text-end px-3 py-2">الضريبة</th>
                <th className="text-end px-3 py-2">مطابق</th>
                <th className="text-end px-3 py-2">غير مطابق</th>
                <th className="text-start px-3 py-2">حالة المستند</th>
                <th className="text-start px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const prov = providerById(r.payment_provider_id);
                const period = r.fee_period_start || r.fee_period_end
                  ? `${r.fee_period_start ?? "—"} → ${r.fee_period_end ?? "—"}` : "—";
                return (
                  <>
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="px-3 py-2">{r.issue_date}</td>
                      <td className="px-3 py-2">
                        <a href={`/admin/finance/purchase-invoices/${r.id}`} className="text-primary hover:underline">
                          {r.internal_reference}
                        </a>
                      </td>
                      <td className="px-3 py-2">{prov?.name ?? "—"}</td>
                      <td className="px-3 py-2">{period}</td>
                      <td className="px-3 py-2 tabular-nums text-end">{fmt(r.taxable_amount)}</td>
                      <td className="px-3 py-2 tabular-nums text-end">{fmt(r.vat_amount)}</td>
                      <td className="px-3 py-2 tabular-nums text-end text-emerald-400">{fmt(r.matched_fee_amount)}</td>
                      <td className="px-3 py-2 tabular-nums text-end text-amber-400">{fmt(r.unmatched_fee_amount)}</td>
                      <td className="px-3 py-2">{VAT_DOC_LABEL[r.vat_document_status ?? "pending_review"] ?? "—"}</td>
                      <td className="px-3 py-2">
                        <button className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                          onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                          {expanded === r.id ? "إغلاق" : "إدارة الربط"}
                        </button>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr>
                        <td colSpan={10} className="bg-white/5 px-3 py-3">
                          <LinkSettlementsPanel invoice={r} providerId={r.payment_provider_id} onChanged={load} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinkSettlementsPanel({ invoice, providerId, onChanged }: { invoice: any; providerId: string; onChanged: () => void }) {
  const [links, setLinks] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: l } = await supabase.from("provider_fee_invoice_settlements" as any).select("*").eq("purchase_invoice_id", invoice.id);
    setLinks(l ?? []);
    let q = supabase.from("payment_settlements" as any).select("id, settlement_reference, settlement_date, period_start, period_end, fees_before_vat, fees_vat_amount, provider_id").eq("provider_id", providerId).order("settlement_date", { ascending: false }).limit(200);
    if (invoice.fee_period_start) q = q.gte("settlement_date", invoice.fee_period_start);
    if (invoice.fee_period_end) q = q.lte("settlement_date", invoice.fee_period_end);
    const { data: s } = await q;
    setCandidates(s ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [invoice.id]);

  const linkedIds = useMemo(() => new Set(links.map((x) => x.settlement_id)), [links]);

  const addLink = async (settlement: any) => {
    setSaving(true);
    const { error } = await supabase.from("provider_fee_invoice_settlements" as any).insert({
      purchase_invoice_id: invoice.id,
      settlement_id: settlement.id,
      matched_fee_amount: Number(settlement.fees_before_vat ?? 0),
      matched_vat_amount: Number(settlement.fees_vat_amount ?? 0),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("تم الربط"); await load(); onChanged(); }
  };
  const updateLink = async (id: string, patch: any) => {
    const { error } = await supabase.from("provider_fee_invoice_settlements" as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { await load(); onChanged(); }
  };
  const removeLink = async (id: string) => {
    if (!confirm("إلغاء الربط؟")) return;
    const { error } = await supabase.from("provider_fee_invoice_settlements" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الإلغاء"); await load(); onChanged(); }
  };

  if (loading) return <div className="text-[11px] text-muted-foreground py-2">جارٍ التحميل…</div>;

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-medium mb-1 text-muted-foreground">التسويات المرتبطة</div>
        {links.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">لا يوجد ربط بعد.</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-start px-2 py-1">التسوية</th>
                <th className="text-end px-2 py-1">رسوم مطابقة</th>
                <th className="text-end px-2 py-1">ضريبة مطابقة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const s = candidates.find((c) => c.id === l.settlement_id);
                return (
                  <tr key={l.id} className="border-t border-white/5">
                    <td className="px-2 py-1">{s?.settlement_reference ?? l.settlement_id.slice(0, 8)} · {s?.settlement_date ?? ""}</td>
                    <td className="px-2 py-1 text-end">
                      <input type="number" step="0.01" defaultValue={l.matched_fee_amount}
                        onBlur={(e) => updateLink(l.id, { matched_fee_amount: Number(e.target.value) })}
                        className="w-24 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-end" />
                    </td>
                    <td className="px-2 py-1 text-end">
                      <input type="number" step="0.01" defaultValue={l.matched_vat_amount}
                        onBlur={(e) => updateLink(l.id, { matched_vat_amount: Number(e.target.value) })}
                        className="w-24 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-end" />
                    </td>
                    <td className="px-2 py-1 text-end">
                      <button className="text-red-400 hover:underline text-[10px]" onClick={() => removeLink(l.id)}>إلغاء</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <div className="text-[11px] font-medium mb-1 text-muted-foreground">تسويات مرشحة للربط ({candidates.length})</div>
        {candidates.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">لا توجد تسويات لهذه البوابة ضمن الفترة المحددة.</div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {candidates.filter((c) => !linkedIds.has(c.id)).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-white/5 border border-white/5 text-[11px]">
                <div>{c.settlement_reference} · {c.settlement_date} · رسوم {fmt(c.fees_before_vat)} + ضريبة {fmt(c.fees_vat_amount)}</div>
                <button disabled={saving} className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] disabled:opacity-50"
                  onClick={() => addLink(c)}>ربط</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
