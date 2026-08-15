import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, X, FileMinus, FilePlus, Loader2, Lock, Ban, CheckCircle2 } from "lucide-react";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";

type Kind = "sales" | "purchase";
export type NoteType = "sales_credit_note" | "sales_debit_note" | "purchase_credit_note" | "purchase_debit_note";

const SAR = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ﷼";

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", approved: "معتمد", cancelled: "ملغى",
};
const TAX_LABEL: Record<string, string> = {
  standard_15: "15%", zero_rated: "صفري", exempt: "معفى", out_of_scope: "خارج النطاق",
};

export function CreditDebitNotesPanel({
  invoiceId,
  invoiceKind,
  partyId,
  invoiceTotal,
}: {
  invoiceId: number;
  invoiceKind: Kind;
  partyId: string | null;
  invoiceTotal: number;
}) {
  const qc = useQueryClient();
  const roles = useFinanceRoles();
  const [creating, setCreating] = useState<NoteType | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const invoiceFilterCol =
    invoiceKind === "sales" ? "original_sales_invoice_id" : "original_purchase_invoice_id";

  const { data: notes = [], isLoading, refetch } = useQuery({
    queryKey: ["cdn-list", invoiceKind, invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_debit_notes" as any)
        .select("id, note_number, note_type, issue_date, status, subtotal, vat_amount, total_amount, reason")
        .eq(invoiceFilterCol, invoiceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const netEffect = notes
    .filter((n) => n.status === "approved")
    .reduce((acc, n) => {
      const sign = n.note_type.endsWith("credit_note") ? -1 : 1;
      return acc + sign * Number(n.total_amount || 0);
    }, 0);

  const cancelMut = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const { error } = await supabase.rpc("cancel_credit_debit_note" as any, {
        p_note_id: id,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إلغاء الإشعار");
      qc.invalidateQueries({ queryKey: ["cdn-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const doCancel = (id: number) => {
    const reason = window.prompt("سبب الإلغاء (إلزامي):", "");
    if (!reason || !reason.trim()) return;
    cancelMut.mutate({ id, reason: reason.trim() });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-semibold">الإشعارات الدائنة والمدينة</div>
          <div className="text-[11px] text-muted-foreground">
            لتصحيح الفاتورة المعتمدة بدون تعديلها. تدخل ضمن الإقرار حسب تاريخ الإشعار.
          </div>
        </div>
        {roles.canManage || roles.canAccountant ? (
          <div className="flex gap-2">
            <button
              onClick={() => setCreating(invoiceKind === "sales" ? "sales_credit_note" : "purchase_credit_note")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-[12px]"
            >
              <FileMinus size={12} /> إنشاء إشعار دائن
            </button>
            <button
              onClick={() => setCreating(invoiceKind === "sales" ? "sales_debit_note" : "purchase_debit_note")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-[12px]"
            >
              <FilePlus size={12} /> إنشاء إشعار مدين
            </button>
          </div>
        ) : null}
      </div>

      {netEffect !== 0 && (
        <div className={`rounded-lg p-2 text-[12px] border ${netEffect < 0 ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          صافي أثر الإشعارات المعتمدة: {netEffect >= 0 ? "+" : ""}{SAR(netEffect)} · قيمة الفاتورة الأصلية: {SAR(invoiceTotal)}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] min-w-[640px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">الرقم</th>
              <th className="text-right p-2">النوع</th>
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الإجمالي</th>
              <th className="text-right p-2">الضريبة</th>
              <th className="text-right p-2">الحالة</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">جاري التحميل…</td></tr>}
            {!isLoading && notes.length === 0 && (
              <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">لا توجد إشعارات على هذه الفاتورة.</td></tr>
            )}
            {notes.map((n) => (
              <tr key={n.id} className="border-t border-white/10">
                <td className="p-2 font-medium">{n.note_number}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                    n.note_type.endsWith("credit_note")
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  }`}>
                    {n.note_type.endsWith("credit_note") ? "دائن" : "مدين"}
                  </span>
                </td>
                <td className="p-2">{n.issue_date}</td>
                <td className="p-2 font-medium">{SAR(n.total_amount)}</td>
                <td className="p-2">{SAR(n.vat_amount)}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                    n.status === "approved" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : n.status === "cancelled" ? "bg-white/5 border-white/10 text-muted-foreground"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  }`}>{STATUS_LABEL[n.status] ?? n.status}</span>
                </td>
                <td className="p-2 text-left">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewingId(n.id)} className="px-2 py-1 rounded bg-white/5 text-[11px]">عرض</button>
                    {n.status === "approved" && roles.canManage && (
                      <button onClick={() => doCancel(n.id)} className="p-1 rounded hover:bg-rose-500/20 text-rose-300" title="إلغاء">
                        <Ban size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateNoteDialog
          noteType={creating}
          invoiceId={invoiceId}
          partyId={partyId}
          onClose={() => setCreating(null)}
          onSaved={(newId) => {
            setCreating(null);
            refetch();
            setViewingId(newId);
          }}
        />
      )}

      {viewingId != null && (
        <ViewNoteDialog
          noteId={viewingId}
          onClose={() => setViewingId(null)}
          onChanged={() => refetch()}
        />
      )}
    </div>
  );
}

/* ----------- Create dialog ----------- */

function CreateNoteDialog({
  noteType,
  invoiceId,
  partyId,
  onClose,
  onSaved,
}: {
  noteType: NoteType;
  invoiceId: number;
  partyId: string | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const kind: Kind = noteType.startsWith("sales") ? "sales" : "purchase";
  const invoiceCol = kind === "sales" ? "original_sales_invoice_id" : "original_purchase_invoice_id";
  const partyCol = kind === "sales" ? "customer_id" : "supplier_id";

  // Original invoice items to seed line items from
  const itemsTable = kind === "sales" ? "sales_invoice_items" : "purchase_invoice_items";
  const invoiceFk = kind === "sales" ? "invoice_id" : "purchase_invoice_id";

  const { data: originalItems = [] } = useQuery({
    queryKey: ["cdn-source-items", kind, invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(itemsTable as any)
        .select("id, description, quantity, unit_price, tax_code, tax_rate")
        .eq(invoiceFk, invoiceId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  type DraftItem = {
    original_invoice_item_id: number | null;
    description: string;
    quantity: number;
    unit_price: number;
    tax_code: string;
  };
  const [rows, setRows] = useState<DraftItem[]>([]);

  const seedFromOriginal = () => {
    setRows(originalItems.map((i: any) => ({
      original_invoice_item_id: i.id,
      description: i.description,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      tax_code: i.tax_code,
    })));
  };

  const addBlank = () =>
    setRows((r) => [...r, { original_invoice_item_id: null, description: "", quantity: 1, unit_price: 0, tax_code: "standard_15" }]);

  const totals = rows.reduce(
    (a, r) => {
      const sub = Math.round(r.quantity * r.unit_price * 100) / 100;
      const vat = r.tax_code === "standard_15" ? Math.round(sub * 15) / 100 : 0;
      a.sub += sub; a.vat += vat; a.total += sub + vat;
      return a;
    },
    { sub: 0, vat: 0, total: 0 }
  );

  const save = async () => {
    if (!reason.trim()) return toast.error("أدخل سبب الإشعار");
    if (rows.length === 0) return toast.error("أضف بندًا واحدًا على الأقل");
    setSaving(true);
    const noteInsert: any = {
      note_type: noteType,
      [invoiceCol]: invoiceId,
      [partyCol]: partyId,
      issue_date: issueDate,
      reason: reason.trim(),
      status: "draft",
    };
    const { data: created, error } = await supabase
      .from("credit_debit_notes" as any)
      .insert(noteInsert)
      .select("id")
      .single();
    if (error) { setSaving(false); return toast.error(error.message); }
    const noteId = (created as any).id as number;

    const items = rows.map((r, i) => ({
      note_id: noteId,
      original_invoice_item_id: r.original_invoice_item_id,
      description: r.description || "بند",
      quantity: r.quantity,
      unit_price: r.unit_price,
      tax_code: r.tax_code,
      sort_order: i,
    }));
    const { error: itemsErr } = await supabase.from("credit_debit_note_items" as any).insert(items);
    setSaving(false);
    if (itemsErr) return toast.error(itemsErr.message);
    toast.success("تم إنشاء الإشعار كمسودة");
    onSaved(noteId);
  };

  const title = ({
    sales_credit_note: "إشعار دائن للمبيعات (خصم من الفاتورة)",
    sales_debit_note: "إشعار مدين للمبيعات (زيادة على الفاتورة)",
    purchase_credit_note: "إشعار دائن للمورد (خصم من المشتريات)",
    purchase_debit_note: "إشعار مدين للمورد (زيادة على المشتريات)",
  } as Record<NoteType, string>)[noteType];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl bg-background border border-white/10 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
          <label className="block">
            <div className="text-[11px] text-muted-foreground mb-1">تاريخ الإشعار</div>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10" />
          </label>
          <label className="block">
            <div className="text-[11px] text-muted-foreground mb-1">السبب (إلزامي)</div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: مرتجع، تصحيح كمية، خصم لاحق" className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10" />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={seedFromOriginal} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px]">استيراد بنود الفاتورة</button>
          <button onClick={addBlank} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[11px]"><Plus size={11} /> بند جديد</button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[12px] min-w-[640px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-right p-2">الوصف</th>
                <th className="text-right p-2 w-20">الكمية</th>
                <th className="text-right p-2 w-24">السعر</th>
                <th className="text-right p-2 w-24">الضريبة</th>
                <th className="text-right p-2 w-24">الإجمالي</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">أضف بنودًا يدويًا أو استورد من الفاتورة الأصلية.</td></tr>}
              {rows.map((r, i) => {
                const sub = Math.round(r.quantity * r.unit_price * 100) / 100;
                const vat = r.tax_code === "standard_15" ? Math.round(sub * 15) / 100 : 0;
                return (
                  <tr key={i} className="border-t border-white/10">
                    <td className="p-1"><input value={r.description} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1" /></td>
                    <td className="p-1"><input type="number" step="0.001" value={r.quantity} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1" /></td>
                    <td className="p-1"><input type="number" step="0.01" value={r.unit_price} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1" /></td>
                    <td className="p-1">
                      <select value={r.tax_code} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, tax_code: e.target.value } : x))} className="w-full bg-black/40 border border-white/10 rounded px-1 py-1">
                        {Object.entries(TAX_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="p-2 text-[11px]">{SAR(sub + vat)}</td>
                    <td className="p-1"><button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-rose-400"><Trash2 size={12} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[12px]">
          <Cell label="الإجمالي قبل الضريبة" value={SAR(totals.sub)} />
          <Cell label="الضريبة" value={SAR(totals.vat)} />
          <Cell label="الإجمالي" value={SAR(totals.total)} highlight />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5">إلغاء</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold disabled:opacity-50">
            {saving && <Loader2 size={13} className="animate-spin" />}
            حفظ كمسودة
          </button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${highlight ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 bg-black/30"}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`font-semibold ${highlight ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}

/* ----------- View dialog with approve/edit-items ----------- */

export function ViewNoteDialog({ noteId, onClose, onChanged }: { noteId: number; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const roles = useFinanceRoles();
  const [overrideReason, setOverrideReason] = useState("");

  const { data: note, isLoading, refetch } = useQuery({
    queryKey: ["cdn-detail", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_debit_notes" as any).select("*").eq("id", noteId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["cdn-detail-items", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_debit_note_items" as any)
        .select("*").eq("note_id", noteId).order("sort_order");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: journals = [], refetch: refetchJournals } = useQuery({
    queryKey: ["cdn-detail-journals", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries" as any)
        .select("id, entry_number, entry_date, status, source_type, total_debit, total_credit")
        .in("source_type", ["credit_debit_note_approval", "credit_debit_note_cancel"])
        .eq("source_id", String(noteId))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: linkedInvoice } = useQuery({
    enabled: !!note,
    queryKey: ["cdn-detail-invoice", noteId, note?.original_sales_invoice_id, note?.original_purchase_invoice_id],
    queryFn: async () => {
      if (note?.original_sales_invoice_id) {
        const { data } = await supabase
          .from("sales_invoices" as any)
          .select("id, invoice_number, total_amount, paid_amount, remaining_amount, payment_status")
          .eq("id", note.original_sales_invoice_id).maybeSingle();
        return data ? { kind: "sales" as const, ...(data as any) } : null;
      }
      if (note?.original_purchase_invoice_id) {
        const { data } = await supabase
          .from("purchase_invoices" as any)
          .select("id, internal_reference, supplier_invoice_number, total_amount, paid_amount, remaining_amount, payment_status")
          .eq("id", note.original_purchase_invoice_id).maybeSingle();
        return data ? { kind: "purchase" as const, ...(data as any) } : null;
      }
      return null;
    },
  });

  const refreshAll = () => {
    refetch();
    refetchJournals();
    onChanged();
    qc.invalidateQueries();
  };

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("approve_credit_debit_note" as any, {
        p_note_id: noteId,
        p_override_reason: overrideReason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم اعتماد الإشعار وتحديث رصيد الفاتورة");
      refreshAll();
    },
    onError: (e: any) => toast.error(e?.message || "تعذر اعتماد الإشعار"),
  });

  const cancel = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase.rpc("cancel_credit_debit_note" as any, {
        p_note_id: noteId,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إلغاء الإشعار وإعادة رصيد الفاتورة");
      refreshAll();
    },
    onError: (e: any) => toast.error(e?.message || "تعذر إلغاء الإشعار"),
  });

  if (isLoading || !note) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const isDraft = note.status === "draft";
  const isApproved = note.status === "approved";
  const invoiceHref = note.original_sales_invoice_id
    ? `/admin/finance/sales-invoices/${note.original_sales_invoice_id}`
    : note.original_purchase_invoice_id
      ? `/admin/finance/purchase-invoices/${note.original_purchase_invoice_id}`
      : null;
  const invoiceLabel = linkedInvoice
    ? (linkedInvoice.kind === "sales"
        ? linkedInvoice.invoice_number
        : (linkedInvoice.internal_reference || linkedInvoice.supplier_invoice_number))
    : "الفاتورة الأصلية";


  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl bg-background border border-white/10 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{note.note_number}</div>
            <div className="text-[11px] text-muted-foreground">{note.reason}</div>
          </div>
          <div className="flex items-center gap-2">
            {isApproved && <span className="inline-flex items-center gap-1 text-emerald-300 text-[11px]"><Lock size={11} /> معتمد</span>}
            {note.status === "cancelled" && <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px]"><Ban size={11} /> ملغى</span>}
            <button onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[12px]">
          <Cell label="الحالة" value={STATUS_LABEL[note.status] ?? note.status} />
          <Cell label="التاريخ" value={note.issue_date} />
          <Cell label="النوع" value={note.note_type.endsWith("credit_note") ? "دائن" : "مدين"} />
          <Cell label="الإجمالي قبل الضريبة" value={SAR(note.subtotal)} />
          <Cell label="الضريبة" value={SAR(note.vat_amount)} />
          <Cell label="الإجمالي" value={SAR(note.total_amount)} highlight />
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">الفاتورة الأصلية</span>
            {invoiceHref ? (
              <a href={invoiceHref} className="text-gold hover:underline">{invoiceLabel} · فتح الفاتورة</a>
            ) : <span>—</span>}
          </div>
          {linkedInvoice && (
            <div className="text-muted-foreground">
              الإجمالي: {SAR(linkedInvoice.total_amount)} · المدفوع: {SAR(linkedInvoice.paid_amount)} ·
              المتبقي: {SAR(linkedInvoice.remaining_amount)} · حالة السداد: {linkedInvoice.payment_status}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] space-y-1">
          <div className="text-muted-foreground">القيود المحاسبية</div>
          {journals.length === 0 ? (
            <div className="text-muted-foreground">لا يوجد قيد مرتبط (خارج نطاق الترحيل التلقائي أو لم يُعتمد بعد).</div>
          ) : journals.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-2">
              <span>{j.entry_number} · {j.entry_date} · {j.source_type === "credit_debit_note_cancel" ? "قيد عكسي" : "قيد الاعتماد"}</span>
              <span className={j.status === "reversed" ? "text-muted-foreground" : "text-emerald-300"}>{j.status}</span>
            </div>
          ))}
        </div>


        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[12px] min-w-[560px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-right p-2">الوصف</th>
                <th className="text-right p-2 w-16">الكمية</th>
                <th className="text-right p-2 w-24">السعر</th>
                <th className="text-right p-2 w-16">الضريبة</th>
                <th className="text-right p-2 w-24">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="p-2">{r.description}</td>
                  <td className="p-2">{r.quantity}</td>
                  <td className="p-2">{SAR(r.unit_price)}</td>
                  <td className="p-2">{TAX_LABEL[r.tax_code] ?? r.tax_code}</td>
                  <td className="p-2">{SAR(r.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {note.overage_override_reason && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200 text-[11px]">
            سبب تجاوز الرصيد: {note.overage_override_reason}
          </div>
        )}
        {note.cancel_reason && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] text-muted-foreground">
            سبب الإلغاء: {note.cancel_reason}
          </div>
        )}

        {isDraft && (roles.canManage || roles.canAccountant) && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="text-[12px] font-semibold">اعتماد الإشعار</div>
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="سبب تجاوز رصيد الفاتورة (يُستخدم فقط إذا لزم)"
              className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]"
            />
            <div className="flex justify-end">
              <button
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold disabled:opacity-50"
              >
                {approve.isPending && <Loader2 size={13} className="animate-spin" />}
                <CheckCircle2 size={13} /> اعتماد وإنشاء القيد
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
