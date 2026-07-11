import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/finance/journal-entries")({
  ssr: false,
  component: JournalEntriesPage,
});

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-white/10 text-muted-foreground" },
  posted: { label: "مرحّل", cls: "bg-emerald-500/20 text-emerald-300" },
  reversed: { label: "معكوس", cls: "bg-red-500/20 text-red-300" },
};

function JournalEntriesPage() {
  const qc = useQueryClient();
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_entries")
        .select("*").order("entry_date", { ascending: false }).order("entry_number", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const reverse = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("reverse_journal_entry", { p_entry_id: id, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم إنشاء قيد عكسي"); qc.invalidateQueries({ queryKey: ["journal-entries"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">القيود اليومية</h2>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} className="ml-1" /> قيد يدوي</Button>
      </div>

      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs">
              <tr>
                <th className="p-2 text-right">الرقم</th>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">الوصف</th>
                <th className="p-2 text-right">المصدر</th>
                <th className="p-2 text-right">مدين</th>
                <th className="p-2 text-right">دائن</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {(entries || []).map((e: any) => (
                <tr key={e.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setOpenEntry(e.id)}>
                  <td className="p-2 font-mono text-xs">{e.entry_number}</td>
                  <td className="p-2">{e.entry_date}</td>
                  <td className="p-2">{e.description}</td>
                  <td className="p-2 text-xs text-muted-foreground">{e.source_type}</td>
                  <td className="p-2 font-mono">{Number(e.total_debit).toFixed(2)}</td>
                  <td className="p-2 font-mono">{Number(e.total_credit).toFixed(2)}</td>
                  <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_LABEL[e.status].cls}`}>{STATUS_LABEL[e.status].label}</span></td>
                  <td className="p-2">
                    {e.status === "posted" && (
                      <Button size="sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); const r = prompt("سبب العكس:"); if (r) reverse.mutate({ id: e.id, reason: r }); }}>
                        <RotateCcw size={12} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openEntry && <EntryDrawer id={openEntry} onClose={() => setOpenEntry(null)} />}
      {showNew && <NewEntryModal onClose={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["journal-entries"] }); }} />}
    </div>
  );
}

function EntryDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["je-detail", id],
    queryFn: async () => {
      const [{ data: e }, { data: lines }] = await Promise.all([
        supabase.from("journal_entries").select("*").eq("id", id).single(),
        supabase.from("journal_entry_lines").select("*, chart_of_accounts(code,name_ar)").eq("journal_entry_id", id).order("line_order"),
      ]);
      return { entry: e, lines: lines || [] };
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={onClose}>
      <div className="w-[600px] max-w-full bg-background border-l border-white/10 h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-semibold">{data?.entry?.entry_number}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}><X size={16} /></Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">التاريخ:</span> {data?.entry?.entry_date}</div>
            <div><span className="text-muted-foreground">المصدر:</span> {data?.entry?.source_type}</div>
            <div><span className="text-muted-foreground">الوصف:</span> {data?.entry?.description}</div>
            <div><span className="text-muted-foreground">الحالة:</span> <Badge variant="outline">{data?.entry?.status}</Badge></div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-white/5">
              <tr><th className="p-2 text-right">الحساب</th><th className="p-2 text-right">الوصف</th><th className="p-2 text-right">مدين</th><th className="p-2 text-right">دائن</th></tr>
            </thead>
            <tbody>
              {data?.lines.map((l: any) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="p-2">{l.chart_of_accounts?.code} — {l.chart_of_accounts?.name_ar}</td>
                  <td className="p-2 text-muted-foreground">{l.description}</td>
                  <td className="p-2 font-mono">{Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : ""}</td>
                  <td className="p-2 font-mono">{Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-white/5 font-semibold">
              <tr><td className="p-2" colSpan={2}>الإجمالي</td>
                <td className="p-2 font-mono">{Number(data?.entry?.total_debit || 0).toFixed(2)}</td>
                <td className="p-2 font-mono">{Number(data?.entry?.total_credit || 0).toFixed(2)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function NewEntryModal({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Array<{ account_code: string; debit: string; credit: string; description: string }>>([
    { account_code: "", debit: "", credit: "", description: "" },
    { account_code: "", debit: "", credit: "", description: "" },
  ]);

  const { data: accounts } = useQuery({
    queryKey: ["coa-active"],
    queryFn: async () => {
      const { data } = await supabase.from("chart_of_accounts").select("code,name_ar,allow_manual_entries").eq("is_active", true).order("code");
      return (data || []).filter((a: any) => a.allow_manual_entries);
    },
  });

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { d, c, ok: Math.abs(d - c) < 0.01 && d > 0 };
  }, [lines]);

  const post = useMutation({
    mutationFn: async () => {
      const payload = lines.filter((l) => l.account_code && (Number(l.debit) > 0 || Number(l.credit) > 0)).map((l) => ({
        account_code: l.account_code,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description,
      }));
      const { error } = await supabase.rpc("post_journal_entry", {
        p_entry_date: date,
        p_description: description,
        p_source_type: "manual",
        p_source_id: null,
        p_lines: payload,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم ترحيل القيد"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-white/10 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-semibold">قيد يدوي جديد</h3>
          <Button size="sm" variant="ghost" onClick={onClose}><X size={16} /></Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">التاريخ</label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">الوصف</label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 items-center">
                <select className="col-span-4 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs" value={l.account_code} onChange={(e) => { const n = [...lines]; n[i].account_code = e.target.value; setLines(n); }}>
                  <option value="">اختر حساب</option>
                  {(accounts || []).map((a: any) => <option key={a.code} value={a.code}>{a.code} — {a.name_ar}</option>)}
                </select>
                <Input className="col-span-3" placeholder="وصف" value={l.description} onChange={(e) => { const n = [...lines]; n[i].description = e.target.value; setLines(n); }} />
                <Input className="col-span-2" type="number" placeholder="مدين" value={l.debit} onChange={(e) => { const n = [...lines]; n[i].debit = e.target.value; if (e.target.value) n[i].credit = ""; setLines(n); }} />
                <Input className="col-span-2" type="number" placeholder="دائن" value={l.credit} onChange={(e) => { const n = [...lines]; n[i].credit = e.target.value; if (e.target.value) n[i].debit = ""; setLines(n); }} />
                <Button size="sm" variant="ghost" className="col-span-1" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={12} /></Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setLines([...lines, { account_code: "", debit: "", credit: "", description: "" }])}><Plus size={12} /> سطر</Button>
          </div>
          <div className={`text-sm p-2 rounded ${totals.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
            مدين: {totals.d.toFixed(2)} — دائن: {totals.c.toFixed(2)} {totals.ok ? "✓ متوازن" : "⚠ غير متوازن"}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button disabled={!totals.ok || post.isPending} onClick={() => post.mutate()}>ترحيل</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
