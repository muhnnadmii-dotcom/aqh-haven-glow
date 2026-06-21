import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Eye, Loader2, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/import-batches")({
  ssr: false,
  component: ImportBatchesPage,
});

type BatchRow = {
  id: string;
  created_at: string;
  file_name: string;
  sheet_name: string | null;
  import_type: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  duplicate_rows: number;
  imported_by: string | null;
  status: string;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  summary_json: any;
};

type OpRow = {
  id: string;
  date: string;
  amount: number;
  account_type: string;
  attachment_status: string | null;
  internal_review_status: string | null;
  label: string;
  deleted_at: string | null;
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ar-SA-u-ca-gregory-nu-latn");
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    archived: "bg-red-500/15 text-red-300 border-red-500/30",
    partial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
  const labels: Record<string, string> = { active: "نشطة", archived: "مؤرشفة", partial: "جزئية" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border ${map[status] ?? map.active}`}>
      {labels[status] ?? status}
    </span>
  );
}

function ImportBatchesPage() {
  const { canManage, loading: rolesLoading } = useFinanceRoles();
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, { active: number; archived: number }>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("finance_import_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("تعذر تحميل الدفعات");
    } else {
      setRows((data ?? []) as BatchRow[]);
      // Fetch counts in parallel
      const map: Record<string, { active: number; archived: number }> = {};
      await Promise.all(
        (data ?? []).map(async (b: any) => {
          const table = b.import_type === "incomes" ? "finance_incomes" : "finance_expenses";
          const [active, archived] = await Promise.all([
            supabase.from(table).select("id", { count: "exact", head: true }).eq("import_batch_id", b.id).is("deleted_at", null),
            supabase.from(table).select("id", { count: "exact", head: true }).eq("import_batch_id", b.id).not("deleted_at", "is", null),
          ]);
          map[b.id] = { active: active.count ?? 0, archived: archived.count ?? 0 };
        }),
      );
      setCounts(map);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const openBatch = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">دفعات الاستيراد</h2>
        <div className="flex items-center gap-2">
          <select
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">الكل</option>
            <option value="active">نشطة فقط</option>
            <option value="archived">مؤرشفة فقط</option>
          </select>
          <button onClick={load} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5">
            <RefreshCw size={12} /> تحديث
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs text-muted-foreground">
            <tr>
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الملف</th>
              <th className="text-right p-2">النوع</th>
              <th className="text-right p-2">الشيت</th>
              <th className="text-right p-2">مقروء</th>
              <th className="text-right p-2">مستورد</th>
              <th className="text-right p-2">متخطى</th>
              <th className="text-right p-2">أخطاء</th>
              <th className="text-right p-2">مكررات</th>
              <th className="text-right p-2">نشطة الآن</th>
              <th className="text-right p-2">مؤرشفة</th>
              <th className="text-right p-2">الحالة</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} className="p-6 text-center text-muted-foreground"><Loader2 className="inline animate-spin" size={14} /> جارٍ التحميل…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">لا توجد دفعات</td></tr>
            ) : filtered.map((r) => {
              const c = counts[r.id] ?? { active: 0, archived: 0 };
              return (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="p-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="p-2 max-w-[180px] truncate" title={r.file_name}>{r.file_name}</td>
                  <td className="p-2">{r.import_type === "incomes" ? "دخل" : "مصروفات"}</td>
                  <td className="p-2">{r.sheet_name ?? "—"}</td>
                  <td className="p-2">{r.total_rows}</td>
                  <td className="p-2">{r.imported_rows}</td>
                  <td className="p-2">{r.skipped_rows}</td>
                  <td className="p-2">{r.error_rows}</td>
                  <td className="p-2">{r.duplicate_rows}</td>
                  <td className="p-2">{c.active}</td>
                  <td className="p-2">{c.archived}</td>
                  <td className="p-2"><StatusBadge status={r.status} /></td>
                  <td className="p-2">
                    <button
                      onClick={() => setOpenId(r.id)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                    >
                      <Eye size={12} /> فتح
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openBatch && (
        <BatchDrawer
          batch={openBatch}
          canManage={canManage && !rolesLoading}
          onClose={() => setOpenId(null)}
          onChanged={() => { setOpenId(null); load(); }}
        />
      )}
    </div>
  );
}

function BatchDrawer({ batch, canManage, onClose, onChanged }: {
  batch: BatchRow; canManage: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [ops, setOps] = useState<OpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const [busy, setBusy] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const table = batch.import_type === "incomes" ? "finance_incomes" : "finance_expenses";
      const dateCol = batch.import_type === "incomes" ? "income_date" : "expense_date";
      const { data } = await supabase
        .from(table)
        .select("*")
        .eq("import_batch_id", batch.id)
        .order(dateCol, { ascending: false })
        .limit(500);
      const mapped: OpRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        date: r[dateCol],
        amount: Number(r.amount),
        account_type: r.account_type,
        attachment_status: r.attachment_status ?? null,
        internal_review_status: r.internal_review_status ?? null,
        label: batch.import_type === "incomes" ? (r.source_name ?? "—") : (r.item_name ?? r.supplier_name ?? "—"),
        deleted_at: r.deleted_at ?? null,
      }));
      // resolve source name for incomes if missing
      if (batch.import_type === "incomes") {
        const ids = Array.from(new Set((data ?? []).map((r: any) => r.income_source_id).filter(Boolean)));
        if (ids.length) {
          const { data: srcs } = await supabase.from("finance_income_sources").select("id,name").in("id", ids);
          const sm = new Map((srcs ?? []).map((s: any) => [s.id, s.name]));
          (data ?? []).forEach((r: any, i: number) => { if (r.income_source_id && sm.get(r.income_source_id)) mapped[i].label = sm.get(r.income_source_id)!; });
        }
      }
      setOps(mapped);
      setLoading(false);
    })();
  }, [batch.id, batch.import_type]);

  const filtered = useMemo(() => {
    if (filter === "active") return ops.filter((o) => !o.deleted_at);
    if (filter === "archived") return ops.filter((o) => o.deleted_at);
    return ops;
  }, [ops, filter]);

  async function archive() {
    setBusy(true);
    const { data, error } = await supabase.rpc("finance_archive_import_batch", { p_batch_id: batch.id, p_reason: reason || "archive_batch" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تمت أرشفة الدفعة (${JSON.stringify(data)})`);
    onChanged();
  }

  async function restore() {
    if (!confirm("سيتم استعادة كل العمليات المرتبطة بهذه الدفعة. متابعة؟")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("finance_restore_import_batch", { p_batch_id: batch.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تمت استعادة الدفعة (${JSON.stringify(data)})`);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={onClose}>
      <div className="bg-background border-l border-white/10 w-full max-w-2xl h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">تفاصيل الدفعة</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={16} /></button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded border border-white/10 p-3 bg-white/5">
            <div><span className="text-muted-foreground">الملف:</span> {batch.file_name}</div>
            <div><span className="text-muted-foreground">الشيت:</span> {batch.sheet_name ?? "—"}</div>
            <div><span className="text-muted-foreground">النوع:</span> {batch.import_type === "incomes" ? "دخل" : "مصروفات"}</div>
            <div><span className="text-muted-foreground">الحالة:</span> <StatusBadge status={batch.status} /></div>
            <div><span className="text-muted-foreground">وقت الاستيراد:</span> {fmtDate(batch.created_at)}</div>
            <div><span className="text-muted-foreground">المستورد:</span> {batch.imported_by?.slice(0, 8) ?? "—"}</div>
            <div>مقروء: {batch.total_rows}</div>
            <div>مستورد: {batch.imported_rows}</div>
            <div>متخطى: {batch.skipped_rows}</div>
            <div>أخطاء: {batch.error_rows}</div>
            <div>مكررات: {batch.duplicate_rows}</div>
            {batch.archived_at && (
              <>
                <div className="col-span-2 pt-2 border-t border-white/10 text-red-300">
                  مؤرشفة في {fmtDate(batch.archived_at)}
                </div>
                {batch.archive_reason && <div className="col-span-2 text-muted-foreground">السبب: {batch.archive_reason}</div>}
              </>
            )}
          </div>

          {batch.summary_json && (
            <details className="rounded border border-white/10 p-2 bg-white/5">
              <summary className="cursor-pointer text-xs text-muted-foreground">Summary JSON</summary>
              <pre className="text-[10px] mt-2 overflow-x-auto">{JSON.stringify(batch.summary_json, null, 2)}</pre>
            </details>
          )}

          {canManage && (
            <div className="flex items-center gap-2">
              {batch.status !== "archived" ? (
                <button
                  onClick={() => setShowArchiveDialog(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25"
                >
                  <Archive size={12} /> أرشفة هذه الدفعة
                </button>
              ) : (
                <button
                  onClick={restore}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                >
                  <ArchiveRestore size={12} /> استعادة الدفعة
                </button>
              )}
              {busy && <Loader2 className="animate-spin" size={14} />}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <h4 className="text-sm font-semibold">العمليات المرتبطة ({ops.length})</h4>
            <select
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">الكل</option>
              <option value="active">نشطة فقط</option>
              <option value="archived">مؤرشفة فقط</option>
            </select>
          </div>

          <div className="rounded border border-white/10 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-muted-foreground">
                <tr>
                  <th className="text-right p-2">التاريخ</th>
                  <th className="text-right p-2">المبلغ</th>
                  <th className="text-right p-2">{batch.import_type === "incomes" ? "المصدر" : "البيان/المورد"}</th>
                  <th className="text-right p-2">الحساب</th>
                  <th className="text-right p-2">المرفق</th>
                  <th className="text-right p-2">المراجعة</th>
                  <th className="text-right p-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-4 text-center"><Loader2 className="inline animate-spin" size={12} /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">لا توجد عمليات</td></tr>
                ) : filtered.map((o) => (
                  <tr key={o.id} className={`border-t border-white/5 ${o.deleted_at ? "opacity-60" : ""}`}>
                    <td className="p-2 whitespace-nowrap">{o.date}</td>
                    <td className="p-2">{o.amount.toLocaleString()}</td>
                    <td className="p-2 max-w-[160px] truncate" title={o.label}>{o.label}</td>
                    <td className="p-2">{o.account_type === "business" ? "تجاري" : "شخصي"}</td>
                    <td className="p-2">{o.attachment_status ?? "—"}</td>
                    <td className="p-2">{o.internal_review_status ?? "—"}</td>
                    <td className="p-2">{o.deleted_at ? <span className="text-red-300">مؤرشفة</span> : <span className="text-emerald-300">نشطة</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showArchiveDialog && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowArchiveDialog(false)}>
            <div className="bg-background border border-white/10 rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-sm font-semibold mb-2">تأكيد الأرشفة</h4>
              <p className="text-xs text-muted-foreground mb-3">
                سيتم أرشفة جميع العمليات المرتبطة بهذه الدفعة مع الاحتفاظ بها في النظام وسجل التعديلات. هل تريد المتابعة؟
              </p>
              <label className="text-xs text-muted-foreground">سبب الأرشفة</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اختياري"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2 text-xs"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setShowArchiveDialog(false)} className="text-xs px-3 py-1.5 rounded border border-white/10">إلغاء</button>
                <button
                  onClick={() => { setShowArchiveDialog(false); archive(); }}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-300 border border-red-500/30"
                >
                  أرشفة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
