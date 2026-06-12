import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pages")({
  component: PagesAdmin,
});

const KNOWN_PAGES = [
  { key: "home", label: "الصفحة الرئيسية" },
  { key: "about", label: "من نحن" },
  { key: "business_solutions", label: "حلول الأعمال" },
  { key: "contact", label: "تواصل معنا" },
  { key: "maintenance", label: "الصيانة" },
  { key: "consultation", label: "الاستشارة" },
];

type Page = { id?: string; page_key: string; title: string | null; content: Record<string, any> };

function PagesAdmin() {
  const [active, setActive] = useState(KNOWN_PAGES[0].key);
  const [data, setData] = useState<Page | null>(null);
  const [raw, setRaw] = useState("");

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase.from("site_pages").select("*").eq("page_key", active).maybeSingle();
      const p: Page = row as any ?? { page_key: active, title: KNOWN_PAGES.find(k => k.key === active)?.label ?? "", content: {} };
      setData(p);
      setRaw(JSON.stringify(p.content ?? {}, null, 2));
    })();
  }, [active]);

  const save = async () => {
    if (!data) return;
    let parsed: any = {};
    try { parsed = JSON.parse(raw || "{}"); } catch { toast.error("JSON غير صحيح"); return; }
    const payload = { page_key: data.page_key, title: data.title, content: parsed };
    const { error } = await supabase.from("site_pages").upsert(payload, { onConflict: "page_key" });
    if (error) toast.error(error.message); else toast.success("تم الحفظ");
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">صفحات الموقع</h1>
      <div className="flex gap-2 flex-wrap">
        {KNOWN_PAGES.map((p) => (
          <button key={p.key} onClick={() => setActive(p.key)} className={`px-3 py-1.5 rounded-xl text-sm ${active === p.key ? "btn-gold" : "glass"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {data && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground block mb-1">عنوان الصفحة</span>
            <input className={inp} value={data.title ?? ""} onChange={(e) => setData({ ...data, title: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground block mb-1">محتوى الصفحة (JSON مرن — أضف أي مفاتيح/نصوص/روابط صور)</span>
            <textarea rows={18} dir="ltr" className={inp + " resize-none font-mono text-xs"} value={raw} onChange={(e) => setRaw(e.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            هذا المحرر مرن لتعديل أي نص أو صورة بأي صفحة. مثال:
            <code dir="ltr" className="block bg-black/30 p-2 mt-2 rounded">{`{ "hero": { "title": "...", "subtitle": "..." }, "image": "uploads/xxx.jpg" }`}</code>
          </p>
          <div className="flex justify-end">
            <button onClick={save} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save size={16} /> حفظ</button>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
