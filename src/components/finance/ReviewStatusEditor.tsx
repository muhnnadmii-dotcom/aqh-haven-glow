import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ACCOUNTANT_STATUS, INTERNAL_REVIEW, labelOf, toneOf } from "@/lib/finance/constants";
import { ChevronDown, Loader2, Pencil, X } from "lucide-react";

type Table = "finance_incomes" | "finance_expenses";
type Field = "internal_review_status" | "accountant_status";

interface Props {
  table: Table;
  rowId: string;
  field: Field;
  value: string | null;
  note?: string | null;
  canEdit: boolean;
  onChanged: (newValue: string, newNote?: string) => void;
}

export function ReviewStatusEditor({ table, rowId, field, value, note, canEdit, onChanged }: Props) {
  const options = field === "internal_review_status" ? INTERNAL_REVIEW : ACCOUNTANT_STATUS;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const tone = toneOf(options as any, value);
  const label = labelOf(options as any, value);

  const apply = async (newVal: string, newNote?: string) => {
    setSaving(true);
    try {
      const patch: any = { [field]: newVal };
      if (field === "accountant_status" && newNote !== undefined) {
        patch.accountant_note = newNote;
      }
      const { error } = await supabase.from(table).update(patch).eq("id", rowId);
      if (error) throw error;
      onChanged(newVal, field === "accountant_status" ? newNote : undefined);
      toast.success("تم تحديث الحالة");
      setOpen(false);
    } catch (e: any) {
      toast.error("تعذر التحديث: " + (e.message ?? "خطأ"));
    } finally {
      setSaving(false);
    }
  };

  const pick = async (v: string) => {
    if (v === value) { setOpen(false); return; }
    // For accountant needs_fix, open note prompt
    if (field === "accountant_status" && v === "needs_fix") {
      const reason = window.prompt("سبب الحاجة للتعديل (اختياري):", note ?? "") ?? note ?? "";
      await apply(v, reason);
      return;
    }
    await apply(v);
  };

  if (!canEdit) {
    return (
      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${tone}`}>{label}</span>
    );
  }

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap cursor-pointer hover:brightness-125 transition ${tone}`}
        title="اضغط لتغيير الحالة"
      >
        {saving ? <Loader2 size={10} className="animate-spin" /> : null}
        {label}
        <ChevronDown size={10} className="opacity-70" />
      </button>
      {field === "accountant_status" && (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="p-0.5 rounded hover:bg-white/10 text-muted-foreground"
          title="تعديل ملاحظة المحاسب"
        >
          <Pencil size={10} />
        </button>
      )}

      {open && (
        <div className="absolute z-30 top-full mt-1 end-0 min-w-[170px] rounded-lg border border-white/10 bg-background shadow-xl p-1">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => pick(o.value)}
              className={`w-full text-start px-2 py-1.5 rounded text-[11px] hover:bg-white/10 flex items-center gap-2 ${o.value === value ? "bg-white/5" : ""}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full border ${o.tone}`} />
              {o.label}
            </button>
          ))}
        </div>
      )}

      {noteOpen && (
        <NoteModal
          initial={note ?? ""}
          onClose={() => setNoteOpen(false)}
          onSave={async (txt) => {
            await apply(value ?? "not_reviewed", txt);
            setNoteOpen(false);
          }}
        />
      )}
    </div>
  );
}

function NoteModal({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (s: string) => Promise<void> }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="text-sm font-semibold">ملاحظة المحاسب</div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded"><X size={14} /></button>
        </div>
        <div className="p-3 space-y-3">
          <textarea
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px] min-h-[100px]"
            placeholder="اكتب الملاحظة…"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[12px]">إلغاء</button>
            <button
              disabled={busy}
              onClick={async () => { setBusy(true); try { await onSave(v); } finally { setBusy(false); } }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25 disabled:opacity-50"
            >
              {busy && <Loader2 size={12} className="animate-spin" />} حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
