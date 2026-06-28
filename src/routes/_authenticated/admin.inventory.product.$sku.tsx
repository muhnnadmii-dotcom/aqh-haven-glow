import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { toast } from "sonner";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SALLA_COLUMNS, SALLA_GROUPS, SALLA_LONG_TEXT } from "@/lib/aqh-salla-columns";

export const Route = createFileRoute("/_authenticated/admin/inventory/product/$sku")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "staff"]).limit(1).maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
  },
  component: ProductDetailPage,
});

type ProductRow = {
  id: number;
  sku: string;
  name_ar: string;
  category: string | null;
  category_id: number | null;
  image_url: string | null;
  current_qty: number | null;
  cost: number | null;
  price: number | null;
  restock_type: string | null;
  is_active: boolean;
  salla_raw: Record<string, any> | null;
  all_images: string[] | null;
};

function ProductDetailPage() {
  const { sku } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["aqh_product_sku", sku],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products" as any)
        .select("id,sku,name_ar,category,category_id,image_url,current_qty,cost,price,restock_type,is_active,salla_raw,all_images")
        .eq("sku", sku)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ProductRow | null;
    },
  });

  const [core, setCore] = useState<Partial<ProductRow>>({});
  const [raw, setRaw] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!q.data) return;
    setCore({
      sku: q.data.sku,
      name_ar: q.data.name_ar,
      category: q.data.category,
      image_url: q.data.image_url,
      current_qty: q.data.current_qty,
      cost: q.data.cost,
      price: q.data.price,
      restock_type: q.data.restock_type,
      is_active: q.data.is_active,
    });
    // Ensure all 71 keys are present so the user can edit any
    const base: Record<string, any> = {};
    for (const k of SALLA_COLUMNS) base[k] = "";
    setRaw({ ...base, ...(q.data.salla_raw ?? {}) });
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (!q.data) throw new Error("no product");
      // Merge edited core into salla_raw so export stays in sync.
      const mergedRaw: Record<string, any> = { ...raw };
      if (core.name_ar !== undefined) mergedRaw["أسم المنتج"] = core.name_ar;
      if (core.category !== undefined && core.category !== null) mergedRaw["تصنيف المنتج"] = core.category;
      if (core.image_url !== undefined && core.image_url !== null) mergedRaw["صورة المنتج"] = core.image_url;
      if (core.current_qty !== undefined && core.current_qty !== null) mergedRaw["الكمية المتوفرة"] = String(core.current_qty);
      if (core.cost !== undefined && core.cost !== null) mergedRaw["سعر التكلفة"] = String(core.cost);
      if (core.price !== undefined && core.price !== null) mergedRaw["سعر المنتج"] = String(core.price);
      if (core.sku) mergedRaw["رمز المنتج sku"] = core.sku;

      const payload: any = {
        name_ar: core.name_ar ?? q.data.name_ar,
        category: core.category ?? q.data.category,
        image_url: core.image_url ?? q.data.image_url,
        current_qty: core.current_qty != null ? Number(core.current_qty) : q.data.current_qty,
        cost: core.cost != null && core.cost !== ("" as any) ? Number(core.cost) : null,
        price: core.price != null && core.price !== ("" as any) ? Number(core.price) : null,
        restock_type: core.restock_type ?? q.data.restock_type,
        is_active: core.is_active ?? q.data.is_active,
        salla_raw: mergedRaw,
      };
      const { error } = await supabase.from("aqh_products" as any).update(payload).eq("id", q.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["aqh_product_sku", sku] });
      qc.invalidateQueries({ queryKey: ["aqh_products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر الحفظ"),
  });

  if (q.isLoading) {
    return <div className="text-center py-12 text-muted-foreground"><Loader2 className="inline animate-spin" /> جاري التحميل…</div>;
  }
  if (!q.data) {
    return (
      <div className="space-y-3 text-center py-12">
        <div className="text-muted-foreground">المنتج غير موجود</div>
        <Link to="/admin/inventory/products" className="text-gold text-sm hover:underline">رجوع للمنتجات</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav({ to: "/admin/inventory/products" })}>
            <ArrowRight size={14} className="ms-1" /> رجوع
          </Button>
          <h1 className="text-lg font-semibold">{q.data.name_ar}</h1>
          <span className="text-[11px] font-mono text-muted-foreground" dir="ltr">{q.data.sku}</span>
        </div>
        <Button onClick={() => saveM.mutate()} disabled={saveM.isPending} className="bg-gold text-black hover:bg-gold/90">
          {saveM.isPending ? <Loader2 size={14} className="animate-spin ms-1" /> : <Save size={14} className="ms-1" />} حفظ
        </Button>
      </div>

      {/* Core fields */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="text-sm font-semibold text-gold">الحقول الأساسية</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="SKU"><Input dir="ltr" value={core.sku ?? ""} onChange={(e) => setCore({ ...core, sku: e.target.value })} /></Field>
          <Field label="الاسم"><Input value={core.name_ar ?? ""} onChange={(e) => setCore({ ...core, name_ar: e.target.value })} /></Field>
          <Field label="التصنيف"><Input value={core.category ?? ""} onChange={(e) => setCore({ ...core, category: e.target.value })} /></Field>
          <Field label="الكمية الحالية"><Input type="number" value={core.current_qty ?? 0} onChange={(e) => setCore({ ...core, current_qty: Number(e.target.value) })} /></Field>
          <Field label="التكلفة (ر.س)"><Input type="number" step="0.01" value={core.cost ?? ""} onChange={(e) => setCore({ ...core, cost: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label="سعر البيع (ر.س)"><Input type="number" step="0.01" value={core.price ?? ""} onChange={(e) => setCore({ ...core, price: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label="نوع التموين"><Input value={core.restock_type ?? ""} onChange={(e) => setCore({ ...core, restock_type: e.target.value })} /></Field>
          <Field label="رابط الصورة" full>
            <Input dir="ltr" value={core.image_url ?? ""} onChange={(e) => setCore({ ...core, image_url: e.target.value })} />
          </Field>
        </div>
        {core.image_url ? (
          <img src={String(core.image_url).split(",")[0]} alt="" className="w-32 h-32 object-cover rounded border border-white/10" />
        ) : null}
      </section>

      {/* Salla full data */}
      {SALLA_GROUPS.map((g) => (
        <section key={g.label} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm font-semibold text-gold">{g.label}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {g.keys.map((k) => {
              const v = raw[k] ?? "";
              const isLong = SALLA_LONG_TEXT.has(k);
              return (
                <Field key={k} label={k} full={isLong}>
                  {isLong ? (
                    <Textarea rows={4} value={v == null ? "" : String(v)} onChange={(e) => setRaw({ ...raw, [k]: e.target.value })} />
                  ) : (
                    <Input value={v == null ? "" : String(v)} onChange={(e) => setRaw({ ...raw, [k]: e.target.value })} />
                  )}
                </Field>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <Button onClick={() => saveM.mutate()} disabled={saveM.isPending} className="bg-gold text-black hover:bg-gold/90">
          {saveM.isPending ? <Loader2 size={14} className="animate-spin ms-1" /> : <Save size={14} className="ms-1" />} حفظ كل التغييرات
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block space-y-1 ${full ? "md:col-span-2 lg:col-span-3" : ""}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
