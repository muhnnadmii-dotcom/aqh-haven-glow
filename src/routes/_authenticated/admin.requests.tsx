import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  component: RequestsPage,
});

type Status = "new" | "in_progress" | "closed";
type ContactReq = { id: string; name: string; phone: string; type: string; message: string; status: Status; admin_notes: string | null; created_at: string };
type ConsultReq = { id: string; name: string; phone: string; tank_type: string | null; goal: string | null; size: string | null; details: string; status: Status; admin_notes: string | null; created_at: string };

function StatusSelect({ value, onChange }: { value: Status; onChange: (v: Status) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Status)}
      className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs">
      <option value="new" className="bg-background">جديد</option>
      <option value="in_progress" className="bg-background">قيد المتابعة</option>
      <option value="closed" className="bg-background">مغلق</option>
    </select>
  );
}

function RequestsPage() {
  const [tab, setTab] = useState<"contact" | "consultation">("contact");
  const [contacts, setContacts] = useState<ContactReq[]>([]);
  const [consults, setConsults] = useState<ConsultReq[]>([]);

  const load = async () => {
    const [c, cs] = await Promise.all([
      supabase.from("contact_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("consultation_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setContacts((c.data ?? []) as ContactReq[]);
    setConsults((cs.data ?? []) as ConsultReq[]);
  };

  useEffect(() => { load(); }, []);

  const updateContact = async (id: string, patch: Partial<ContactReq>) => {
    const { error } = await supabase.from("contact_requests").update(patch).eq("id", id);
    if (error) toast.error("تعذر التحديث"); else { toast.success("تم"); load(); }
  };
  const updateConsult = async (id: string, patch: Partial<ConsultReq>) => {
    const { error } = await supabase.from("consultation_requests").update(patch).eq("id", id);
    if (error) toast.error("تعذر التحديث"); else { toast.success("تم"); load(); }
  };
  const deleteContact = async (id: string) => {
    if (!confirm("حذف الطلب؟")) return;
    await supabase.from("contact_requests").delete().eq("id", id); load();
  };
  const deleteConsult = async (id: string) => {
    if (!confirm("حذف الاستشارة؟")) return;
    await supabase.from("consultation_requests").delete().eq("id", id); load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">الطلبات</h1>
      <div className="flex gap-2">
        <button onClick={() => setTab("contact")} className={`px-4 py-2 rounded-xl text-sm ${tab === "contact" ? "btn-gold" : "glass"}`}>
          تواصل ({contacts.length})
        </button>
        <button onClick={() => setTab("consultation")} className={`px-4 py-2 rounded-xl text-sm ${tab === "consultation" ? "btn-gold" : "glass"}`}>
          استشارات ({consults.length})
        </button>
      </div>

      {tab === "contact" ? (
        <div className="space-y-3">
          {contacts.length === 0 && <p className="text-muted-foreground text-sm">لا توجد طلبات.</p>}
          {contacts.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold">{r.name} <span className="text-xs text-muted-foreground">— {r.type}</span></div>
                  <a dir="ltr" href={`tel:${r.phone}`} className="text-sm text-gold">{r.phone}</a>
                </div>
                <div className="flex items-center gap-2">
                  <StatusSelect value={r.status} onChange={(v) => updateContact(r.id, { status: v })} />
                  <button onClick={() => deleteContact(r.id)} className="text-xs text-red-400 hover:underline">حذف</button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.message}</p>
              <textarea defaultValue={r.admin_notes ?? ""} onBlur={(e) => e.target.value !== (r.admin_notes ?? "") && updateContact(r.id, { admin_notes: e.target.value })}
                placeholder="ملاحظاتك..." rows={2}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none" />
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {consults.length === 0 && <p className="text-muted-foreground text-sm">لا توجد استشارات.</p>}
          {consults.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold">{r.name} <span className="text-xs text-muted-foreground">— {r.goal ?? "—"}</span></div>
                  <a dir="ltr" href={`tel:${r.phone}`} className="text-sm text-gold">{r.phone}</a>
                </div>
                <div className="flex items-center gap-2">
                  <StatusSelect value={r.status} onChange={(v) => updateConsult(r.id, { status: v })} />
                  <button onClick={() => deleteConsult(r.id)} className="text-xs text-red-400 hover:underline">حذف</button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">نوع الحوض: {r.tank_type ?? "—"} · المقاس: {r.size ?? "—"}</div>
              <p className="text-sm whitespace-pre-wrap">{r.details}</p>
              <textarea defaultValue={r.admin_notes ?? ""} onBlur={(e) => e.target.value !== (r.admin_notes ?? "") && updateConsult(r.id, { admin_notes: e.target.value })}
                placeholder="ملاحظاتك..." rows={2}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none" />
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
