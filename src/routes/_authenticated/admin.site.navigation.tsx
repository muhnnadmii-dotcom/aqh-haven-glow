import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Save, ExternalLink as LinkIcon } from "lucide-react";
import {
  fetchNavLinks, createNavLink, updateNavLink, deleteNavLink, reorderNavLinks,
  type SiteNavLink, type NavLocation,
} from "@/lib/site-nav";

export const Route = createFileRoute("/_authenticated/admin/site/navigation")({
  component: NavigationAdmin,
});

const LOCATIONS: { key: NavLocation; label: string; hint: string }[] = [
  { key: "navbar",       label: "القائمة الرئيسية (الهيدر)", hint: "روابط تظهر في أعلى الموقع" },
  { key: "footer_quick", label: "روابط الفوتر السريعة",      hint: "قسم «روابط سريعة» في الفوتر" },
];

function NavigationAdmin() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-1">روابط القائمة والفوتر</h1>
        <p className="text-sm text-muted-foreground">
          أضف/عدّل/أخفِ/رتّب الروابط في القائمة الرئيسية وفي قسم «روابط سريعة» بالفوتر.
        </p>
      </div>
      {LOCATIONS.map((loc) => (
        <LocationEditor key={loc.key} loc={loc} />
      ))}
    </div>
  );
}

function LocationEditor({ loc }: { loc: { key: NavLocation; label: string; hint: string } }) {
  const [items, setItems] = useState<SiteNavLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ label: "", href: "", external: false, open_in_new_tab: false });

  async function reload() {
    setLoading(true);
    try { setItems(await fetchNavLinks(loc.key)); } finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [loc.key]);

  async function save(i: SiteNavLink) {
    setSavingId(i.id);
    try {
      await updateNavLink(i.id, {
        label: i.label, href: i.href, visible: i.visible,
        external: i.external, open_in_new_tab: i.open_in_new_tab,
      });
    } finally { setSavingId(null); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الرابط؟")) return;
    await deleteNavLink(id);
    setItems((arr) => arr.filter((x) => x.id !== id));
  }

  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    await reorderNavLinks(next.map((x) => x.id));
  }

  async function add() {
    if (!newRow.label.trim() || !newRow.href.trim()) return;
    setAdding(true);
    try {
      await createNavLink({
        location: loc.key,
        label: newRow.label.trim(),
        href: newRow.href.trim(),
        sort_order: (items.length + 1) * 10,
        visible: true,
        external: newRow.external,
        open_in_new_tab: newRow.open_in_new_tab,
      });
      setNewRow({ label: "", href: "", external: false, open_in_new_tab: false });
      await reload();
    } finally { setAdding(false); }
  }

  function patch(id: string, p: Partial<SiteNavLink>) {
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold">{loc.label}</h2>
        <p className="text-xs text-muted-foreground">{loc.hint}</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل…</div>
      ) : (
        <div className="space-y-2">
          {items.map((i, idx) => (
            <div key={i.id} className="grid grid-cols-12 gap-2 items-center rounded-xl border border-white/10 bg-white/[0.02] p-2">
              <div className="col-span-12 sm:col-span-3">
                <label className="text-[10px] text-muted-foreground">الاسم</label>
                <input value={i.label} onChange={(e) => patch(i.id, { label: e.target.value })}
                  className="w-full rounded-lg bg-background/40 border border-white/10 px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <label className="text-[10px] text-muted-foreground">الرابط (مثال: /services أو https://...)</label>
                <input value={i.href} onChange={(e) => patch(i.id, { href: e.target.value })}
                  className="w-full rounded-lg bg-background/40 border border-white/10 px-2 py-1.5 text-sm" dir="ltr" />
              </div>
              <div className="col-span-6 sm:col-span-2 flex items-end gap-2">
                <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <input type="checkbox" checked={i.external} onChange={(e) => patch(i.id, { external: e.target.checked })} />
                  خارجي
                </label>
                <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <input type="checkbox" checked={i.open_in_new_tab} onChange={(e) => patch(i.id, { open_in_new_tab: e.target.checked })} />
                  نافذة جديدة
                </label>
              </div>
              <div className="col-span-6 sm:col-span-3 flex items-end justify-end gap-1">
                <button onClick={() => move(idx, -1)} className="h-8 w-8 grid place-items-center rounded-lg glass hover:bg-white/10" title="أعلى"><ChevronUp size={14} /></button>
                <button onClick={() => move(idx, 1)}  className="h-8 w-8 grid place-items-center rounded-lg glass hover:bg-white/10" title="أسفل"><ChevronDown size={14} /></button>
                <button onClick={async () => { const next = { ...i, visible: !i.visible }; patch(i.id, { visible: next.visible }); await updateNavLink(i.id, { visible: next.visible }); }}
                  className={`h-8 w-8 grid place-items-center rounded-lg ${i.visible ? "glass hover:bg-white/10" : "bg-rose-500/20 text-rose-300"}`}
                  title={i.visible ? "إخفاء" : "إظهار"}>
                  {i.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => save(i)} disabled={savingId === i.id}
                  className="h-8 px-2 inline-flex items-center gap-1 rounded-lg btn-gold text-xs"><Save size={12} /> حفظ</button>
                <button onClick={() => remove(i.id)} className="h-8 w-8 grid place-items-center rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" title="حذف"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">لا يوجد روابط بعد.</div>
          )}
        </div>
      )}

      {/* Add new */}
      <div className="mt-5 pt-4 border-t border-white/10">
        <div className="text-xs font-bold mb-2 inline-flex items-center gap-1"><Plus size={12} /> إضافة رابط جديد</div>
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-12 sm:col-span-3">
            <label className="text-[10px] text-muted-foreground">الاسم</label>
            <input value={newRow.label} onChange={(e) => setNewRow({ ...newRow, label: e.target.value })}
              placeholder="مثال: المدونة"
              className="w-full rounded-lg bg-background/40 border border-white/10 px-2 py-1.5 text-sm" />
          </div>
          <div className="col-span-12 sm:col-span-4">
            <label className="text-[10px] text-muted-foreground">الرابط</label>
            <input value={newRow.href} onChange={(e) => setNewRow({ ...newRow, href: e.target.value })}
              placeholder="/blog أو https://..."
              className="w-full rounded-lg bg-background/40 border border-white/10 px-2 py-1.5 text-sm" dir="ltr" />
          </div>
          <div className="col-span-6 sm:col-span-3 flex gap-3 text-xs text-muted-foreground">
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={newRow.external} onChange={(e) => setNewRow({ ...newRow, external: e.target.checked })} />
              خارجي
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={newRow.open_in_new_tab} onChange={(e) => setNewRow({ ...newRow, open_in_new_tab: e.target.checked })} />
              نافذة جديدة
            </label>
          </div>
          <div className="col-span-6 sm:col-span-2">
            <button onClick={add} disabled={adding || !newRow.label.trim() || !newRow.href.trim()}
              className="w-full btn-gold rounded-lg px-3 py-2 text-xs inline-flex items-center justify-center gap-1 disabled:opacity-50">
              <Plus size={12} /> إضافة
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 inline-flex items-center gap-1">
          <LinkIcon size={10} /> الروابط الداخلية تبدأ بـ <code className="bg-white/5 px-1 rounded">/</code> — الروابط الخارجية فعّل خيار «خارجي».
        </p>
      </div>
    </section>
  );
}
