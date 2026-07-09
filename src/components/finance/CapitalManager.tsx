import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Wallet } from "lucide-react";
import {
  listCapital, createCapital, updateCapital, deleteCapital,
  computeInvestedCapital, CAPITAL_TYPE_LABELS, type CapitalEntry, type CapitalEntryType,
} from "@/lib/finance/capital";
import { fmtSAR } from "@/lib/finance/constants";

export function CapitalManager() {
  const [rows, setRows] = useState<CapitalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CapitalEntry | null>(null);
  const [creating, setCreating] = useState<CapitalEntryType | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRows(await listCapital()); }
    catch (e: any) { toast.error(e.message ?? "تعذر التحميل"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const invested = useMemo(() => computeInvestedCapital(rows), [rows]);
  const opening = rows.find((r) => r.entry_type === "opening_balance");

  const remove = async (id: string) => {
    if (!confirm("حذف هذا القيد؟")) return;
    try { await deleteCapital(id); toast.success("تم الحذف"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const badgeTone = (t: CapitalEntryType) =>
    t === "opening_balance" ? "bg-sky-500/15 text-sky-300 border-sky-500/30" :
    t === "capital_injection" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
    "bg-amber-500/15 text-amber-300 border-amber-500/30";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2"><Wallet size={15} className="text-gold" /> رأس المال</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">الرصيد الافتتاحي + ضخّات رأس المال − سحوبات رأس المال</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">رأس المال الحالي المستثمر</div>
          <div className="text-lg font-semibold text-gold font-mono">{fmtSAR(invested)} <span className="text-[10px] text-muted-foreground">ر.س</span></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!opening && (
          <button onClick={() => setCreating("opening_balance")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px]">
            <Plus size={11} /> تسجيل الرصيد الافتتاحي
          </button>
        )}
        <button onClick={() => setCreating("capital_injection")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px]">
          <Plus size={11} /> ضخّ رأس مال
        </button>
        <button onClick={() => setCreating("owner_withdrawal")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]">
          <Plus size={11} /> سحب رأس مال
        </button>
      </div>

      <div className="space-y-1.5">
        {loading ? (
          <div className="text-[12px] text-muted-foreground py-4 text-center">جاري التحميل…</div>
        ) : rows.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-4 text-center">لا توجد قيود بعد. ابدأ بتسجيل الرصيد الافتتاحي.</div>
        ) : rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-white/5 text-[12px]">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${badgeTone(r.entry_type)}`}>{CAPITAL_TYPE_LABELS[r.entry_type]}</span>
              <span className="text-muted-foreground/80 whitespace-nowrap">{r.entry_date}</span>
              {r.note && <span className="truncate text-muted-foreground">— {r.note}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`font-mono ${r.entry_type === "owner_withdrawal" ? "text-amber-300" : "text-emerald-300"}`}>
                {r.entry_type === "owner_withdrawal" ? "−" : "+"}{fmtSAR(r.amount)}
              </span>
              <button onClick={() => setEditing(r)} className="p-1 hover:bg-white/10 rounded"><Pencil size={12} /></button>
              <button onClick={() => remove(r.id)} className="p-1 hover:bg-white/10 rounded text-red-300"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <CapitalDialog
          row={editing}
          initialType={creating}
          onClose={() => { setCreating(null); setEditing(null); }}
          onSaved={() => { setCreating(null); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CapitalDialog({ row, initialType, onClose, onSaved }: {
  row: CapitalEntry | null;
  initialType: CapitalEntryType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !row;
  const [entryType, setEntryType] = useState<CapitalEntryType>(row?.entry_type ?? initialType ?? "capital_injection");
  const [amount, setAmount] = useState(row?.amount != null ? String(row.amount) : "");
  const [entryDate, setEntryDate] = useState(row?.entry_date ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(row?.note ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!isFinite(amt) || amt < 0) { toast.error("مبلغ غير صحيح"); return; }
    if (!entryDate) { toast.error("التاريخ مطلوب"); return; }
    setSaving(true);
    try {
      if (isNew) {
        await createCapital({ entry_type: entryType, amount: amt, entry_date: entryDate, note: note || null });
      } else {
        await updateCapital(row!.id, { entry_type: entryType, amount: amt, entry_date: entryDate, note: note || null });
      }
      toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "تعذر الحفظ");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background border border-white/10 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">{isNew ? "قيد رأس مال جديد" : "تعديل قيد رأس المال"}</div>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="space-y-2 text-[12px]">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">نوع القيد</div>
            <select value={entryType} onChange={(e) => setEntryType(e.target.value as CapitalEntryType)}
              disabled={!isNew && row?.entry_type === "opening_balance"}
              className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10">
              <option value="opening_balance">{CAPITAL_TYPE_LABELS.opening_balance}</option>
              <option value="capital_injection">{CAPITAL_TYPE_LABELS.capital_injection}</option>
              <option value="owner_withdrawal">{CAPITAL_TYPE_LABELS.owner_withdrawal}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">المبلغ (ر.س)</div>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 font-mono" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">التاريخ</div>
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10" />
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">ملاحظة (اختياري)</div>
            <input value={note ?? ""} onChange={(e) => setNote(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold disabled:opacity-50">
            {saving ? "جاري…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
