import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Fish } from "lucide-react";
import { getImageUrl, onImageError } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/admin/tanks")({
  component: AdminTanksPage,
});

type TankRow = {
  id: string;
  user_id: string;
  name: string;
  tank_type: string | null;
  dimensions: string | null;
  volume_liters: number | null;
  primary_image: string | null;
  image_path: string | null;
  city: string | null;
  created_at: string;
};

function AdminTanksPage() {
  const [list, setList] = useState<TankRow[]>([]);
  const [owners, setOwners] = useState<Map<string, { full_name: string | null; phone: string | null }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("customer_tanks")
        .select("id, user_id, name, tank_type, dimensions, volume_liters, primary_image, image_path, city, created_at")
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as TankRow[];
      setList(rows);
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
        const m = new Map();
        (profs ?? []).forEach((p: any) => m.set(p.id, { full_name: p.full_name, phone: p.phone }));
        setOwners(m);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">أحواض العملاء</h1>
        <p className="text-sm text-muted-foreground mt-1">عرض جميع الأحواض المسجلة من العملاء.</p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد أحواض عملاء بعد.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const owner = owners.get(t.user_id);
            const img = t.primary_image || t.image_path;
            return (
              <div key={t.id} className="glass rounded-2xl p-4 flex gap-3">
                {img ? (
                  <img src={getImageUrl(img)} onError={onImageError} alt={t.name} loading="lazy"
                    className="h-20 w-20 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="h-20 w-20 rounded-xl bg-white/5 grid place-items-center text-gold shrink-0"><Fish size={24} /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {owner?.full_name || "بدون اسم"} {owner?.phone ? `· ${owner.phone}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.dimensions || "—"} {t.volume_liters ? `· ${t.volume_liters}L` : ""}
                  </div>
                  {t.city && <div className="text-[11px] text-muted-foreground mt-0.5">{t.city}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
