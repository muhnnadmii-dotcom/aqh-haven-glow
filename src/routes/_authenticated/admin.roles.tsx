import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Save, UserPlus, Users, Shield } from "lucide-react";
import { ADMIN_GROUPS, ADMIN_PAGES } from "@/lib/admin-pages";
import { PageGuard } from "@/components/admin/PageGuard";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: () => (
    <PageGuard pageKey="/admin/roles">
      <RolesAdmin />
    </PageGuard>
  ),
});

type Role = { id: string; name: string; description: string | null };
type Member = { user_id: string; full_name: string | null; phone: string | null };

function RolesAdmin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Role | null>(null);

  const loadRoles = async () => {
    const { data, error } = await supabase
      .from("custom_roles")
      .select("id, name, description")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRoles((data ?? []) as Role[]);
    setLoading(false);
  };

  useEffect(() => { loadRoles(); }, []);

  if (!authLoading && !isAdmin) {
    return (
      <div className="py-16 text-center">
        <Shield size={32} className="mx-auto text-gold mb-3" />
        <p className="text-sm text-muted-foreground">إدارة الصلاحيات متاحة للأدمن فقط.</p>
      </div>
    );
  }

  const createRole = async () => {
    const name = prompt("اسم الدور الجديد (مثل: مشرف معرض)");
    if (!name?.trim()) return;
    const { data, error } = await supabase
      .from("custom_roles")
      .insert({ name: name.trim() })
      .select("id, name, description")
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("تم إنشاء الدور");
    setRoles((r) => [data as Role, ...r]);
    setEditing(data as Role);
  };

  const deleteRole = async (role: Role) => {
    if (!confirm(`حذف دور "${role.name}"؟ سيتم إلغاء ربطه بكل المستخدمين.`)) return;
    const { error } = await supabase.from("custom_roles").delete().eq("id", role.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    setRoles((r) => r.filter((x) => x.id !== role.id));
    if (editing?.id === role.id) setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="text-gold" /> إدارة الصلاحيات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            أنشئ أدوارًا وظيفية وحدد الصفحات التي يستطيع كل دور رؤيتها داخل لوحة الإدارة.
          </p>
        </div>
        <button
          onClick={createRole}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/30 text-gold hover:bg-gold/30 text-sm"
        >
          <Plus size={16} /> إنشاء دور جديد
        </button>
      </div>

      <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-200/90 leading-relaxed">
        ملاحظة: هذه الأدوار طبقة <b>UI/Navigation</b> فوق صلاحيات النظام الأساسية. منح صفحة لمستخدم لا يملك الدور الأساسي
        المطلوب (مثل أدوار المالية) قد يجعله يدخل الصفحة دون رؤية أي بيانات لأن قاعدة البيانات ستحجبها.
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : roles.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          لا توجد أدوار مخصصة بعد. اضغط "إنشاء دور جديد" للبدء.
        </div>
      ) : (
        <div className="grid gap-3">
          {roles.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold">{r.name}</div>
                {r.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
                )}
              </div>
              <button
                onClick={() => setEditing(r)}
                className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
              >
                <Pencil size={12} /> تعديل
              </button>
              <button
                onClick={() => deleteRole(r)}
                className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={12} /> حذف
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RoleEditor role={editing} onClose={() => setEditing(null)} onChange={loadRoles} />
      )}
    </div>
  );
}

function RoleEditor({ role, onClose, onChange }: { role: Role; onClose: () => void; onChange: () => void }) {
  const [tab, setTab] = useState<"info" | "pages" | "users">("info");
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [pages, setPages] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from("custom_role_pages")
        .select("page_key")
        .eq("role_id", role.id);
      setPages(new Set((p ?? []).map((x: any) => x.page_key)));

      const { data: u } = await supabase
        .from("user_custom_roles")
        .select("user_id")
        .eq("role_id", role.id);
      const ids = (u ?? []).map((x: any) => x.user_id);
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        setMembers(ids.map((uid: string) => ({
          user_id: uid,
          full_name: (map.get(uid) as any)?.full_name ?? null,
          phone: (map.get(uid) as any)?.phone ?? null,
        })));
      } else setMembers([]);
    })();
  }, [role.id]);

  const saveInfo = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("custom_roles")
      .update({ name: name.trim(), description: description.trim() || null })
      .eq("id", role.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    onChange();
  };

  const togglePage = async (key: string) => {
    const has = pages.has(key);
    const next = new Set(pages);
    if (has) {
      next.delete(key);
      setPages(next);
      const { error } = await supabase
        .from("custom_role_pages")
        .delete()
        .eq("role_id", role.id)
        .eq("page_key", key);
      if (error) { toast.error(error.message); next.add(key); setPages(new Set(next)); }
    } else {
      next.add(key);
      setPages(next);
      const { error } = await supabase
        .from("custom_role_pages")
        .insert({ role_id: role.id, page_key: key });
      if (error) { toast.error(error.message); next.delete(key); setPages(new Set(next)); }
    }
  };

  const toggleGroup = async (groupKey: string, allOn: boolean) => {
    const groupPages = ADMIN_PAGES.filter((p) => p.group === groupKey);
    if (allOn) {
      // turn off all
      const keys = groupPages.map((p) => p.key);
      const { error } = await supabase
        .from("custom_role_pages")
        .delete()
        .eq("role_id", role.id)
        .in("page_key", keys);
      if (error) { toast.error(error.message); return; }
      const next = new Set(pages);
      keys.forEach((k) => next.delete(k));
      setPages(next);
    } else {
      const toAdd = groupPages.filter((p) => !pages.has(p.key));
      if (!toAdd.length) return;
      const { error } = await supabase
        .from("custom_role_pages")
        .insert(toAdd.map((p) => ({ role_id: role.id, page_key: p.key })));
      if (error) { toast.error(error.message); return; }
      const next = new Set(pages);
      toAdd.forEach((p) => next.add(p.key));
      setPages(next);
    }
  };

  const addMember = async () => {
    const query = prompt("ابحث بالاسم أو رقم الجوال");
    if (!query?.trim()) return;
    const q = query.trim();
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10);
    if (!profs?.length) { toast.error("لم يتم العثور على نتائج"); return; }
    if (profs.length > 1) {
      const list = profs.map((p: any, i: number) => `${i + 1}. ${p.full_name || "بدون اسم"} - ${p.phone || ""}`).join("\n");
      const pick = prompt(`اختر رقم:\n${list}`);
      const idx = Number(pick) - 1;
      if (isNaN(idx) || idx < 0 || idx >= profs.length) return;
      await assignMember(profs[idx]);
    } else {
      await assignMember(profs[0]);
    }
  };

  const assignMember = async (p: any) => {
    const { error } = await supabase
      .from("user_custom_roles")
      .insert({ role_id: role.id, user_id: p.id });
    if (error) { toast.error(error.message); return; }
    toast.success(`تم تعيين ${p.full_name || "المستخدم"} للدور`);
    setMembers((m) => [...m, { user_id: p.id, full_name: p.full_name, phone: p.phone }]);
  };

  const removeMember = async (uid: string) => {
    if (!confirm("إزالة هذا المستخدم من الدور؟")) return;
    const { error } = await supabase
      .from("user_custom_roles")
      .delete()
      .eq("role_id", role.id)
      .eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    setMembers((m) => m.filter((x) => x.user_id !== uid));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col bg-background border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 shrink-0">
          <div className="font-bold flex items-center gap-2"><Shield size={16} className="text-gold" /> {role.name}</div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5"><X size={16} /></button>
        </div>

        <div className="flex gap-1 px-4 pt-3 border-b border-white/10 shrink-0">
          {([
            { k: "info", l: "المعلومات" },
            { k: "pages", l: `الصفحات (${pages.size})` },
            { k: "users", l: `المستخدمون (${members.length})` },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-3 py-2 text-xs rounded-t-lg ${tab === t.k ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "info" && (
            <div className="space-y-3 max-w-lg">
              <div>
                <label className="text-xs text-muted-foreground">اسم الدور</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">الوصف (اختياري)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm resize-none" />
              </div>
              <button
                onClick={saveInfo}
                disabled={saving || !name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/30 text-gold text-sm disabled:opacity-50"
              >
                <Save size={14} /> حفظ
              </button>
            </div>
          )}

          {tab === "pages" && (
            <div className="space-y-4">
              {ADMIN_GROUPS.map((g) => {
                const groupPages = ADMIN_PAGES.filter((p) => p.group === g.key);
                const onCount = groupPages.filter((p) => pages.has(p.key)).length;
                const allOn = onCount === groupPages.length;
                return (
                  <div key={g.key} className="glass rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold">{g.label} <span className="text-xs text-muted-foreground">({onCount}/{groupPages.length})</span></div>
                      <button
                        onClick={() => toggleGroup(g.key, allOn)}
                        className="text-[11px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10"
                      >
                        {allOn ? "إلغاء الكل" : "تحديد الكل"}
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1">
                      {groupPages.map((p) => {
                        const on = pages.has(p.key);
                        return (
                          <label key={p.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-sm">
                            <input type="checkbox" checked={on} onChange={() => togglePage(p.key)} className="accent-gold" />
                            <span className="flex-1">{p.label}</span>
                            {p.financeOnly && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">مالي</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "users" && (
            <div className="space-y-3">
              <button
                onClick={addMember}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold text-sm"
              >
                <UserPlus size={14} /> إضافة مستخدم للدور
              </button>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Users size={14} /> لم يتم تعيين أي مستخدم لهذا الدور.</p>
              ) : (
                <div className="grid gap-2">
                  {members.map((m) => (
                    <div key={m.user_id} className="glass rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{m.full_name || "بدون اسم"}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">{m.phone || "—"}</div>
                      </div>
                      <button
                        onClick={() => removeMember(m.user_id)}
                        className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={12} /> إزالة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
