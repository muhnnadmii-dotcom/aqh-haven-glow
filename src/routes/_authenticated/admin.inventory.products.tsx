import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { toast } from "sonner";
import {
  Boxes, Plus, Pencil, Trash2, Loader2, Search, X, AlertTriangle,
  CheckSquare, Square, Wand2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/inventory/products")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "staff"]).limit(1).maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
    return { role: data.role as "admin" | "staff" };
  },
  component: ProductsPage,
});

type Product = {
  id: number; sku: string; name_ar: string; category: string | null;
  category_id: number | null; image_url: string | null;
  current_qty: number; cost: number | null; is_active: boolean;
  restock_type: string | null;
};

type Category = { id: number; name_ar: string };
type Supplier = { id: string; name_ar: string };

const SAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n) + " ر.س";

function ProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all"); // all/low/out
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState<Product | null>(null);

  const productsQ = useQuery({
    queryKey: ["aqh_products_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products")
        .select("id,sku,name_ar,category,category_id,image_url,current_qty,cost,is_active,restock_type")
        .order("name_ar");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const catsQ = useQuery({
    queryKey: ["aqh_cats_simple"],
    queryFn: async () => {
      const { data } = await supabase.from("aqh_product_categories")
        .select("id,name_ar").order("name_ar");
      return (data ?? []) as Category[];
    },
  });

  const suppliersQ = useQuery({
    queryKey: ["aqh_finance_suppliers_simple"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_suppliers")
        .select("id,name").eq("is_active", true).order("name");
      return ((data ?? []) as { id: string; name: string }[])
        .map((s) => ({ id: s.id, name_ar: s.name })) as Supplier[];
    },
  });

  const linksCountQ = useQuery({
    queryKey: ["aqh_ps_counts"],
    queryFn: async () => {
      const { data } = await supabase.from("aqh_product_suppliers").select("product_id");
      const m = new Map<number, number>();
      (data ?? []).forEach((r: any) => m.set(r.product_id, (m.get(r.product_id) ?? 0) + 1));
      return m;
    },
  });

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (productsQ.data ?? []).filter((p) => {
      if (text) {
        const match = p.name_ar.toLowerCase().includes(text) ||
          p.sku.toLowerCase().includes(text);
        if (!match) return false;
      }
      if (catFilter !== "all") {
        if (catFilter === "none" ? p.category_id != null : String(p.category_id) !== catFilter) return false;
      }
      if (typeFilter !== "all" && p.restock_type !== typeFilter) return false;
      const qty = p.current_qty ?? 0;
      if (stockFilter === "low" && qty > 3) return false;
      if (stockFilter === "out" && qty > 0) return false;
      return true;
    });
  }, [productsQ.data, q, catFilter, typeFilter, stockFilter]);

  const delM = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("aqh_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["aqh_products_admin"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  }
  function toggleOne(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-5 pb-32" dir="rtl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <Boxes size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">إدارة المنتجات</h1>
          <p className="text-xs text-muted-foreground">
            {productsQ.data ? `${productsQ.data.length} منتج · ${filtered.length} ظاهر` : "—"}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
          <Plus size={14} className="ml-1" /> منتج جديد
        </Button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الـ SKU…" className="pr-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger><SelectValue placeholder="التصنيف" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التصنيفات</SelectItem>
            <SelectItem value="none">بدون تصنيف</SelectItem>
            {(catsQ.data ?? []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name_ar}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="نوع التوريد" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="supplier">مورد</SelectItem>
              <SelectItem value="inventory">داخلي</SelectItem>
              <SelectItem value="hidden">مخفي</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger><SelectValue placeholder="المخزون" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الكميات</SelectItem>
              <SelectItem value="low">منخفض (≤ 3)</SelectItem>
              <SelectItem value="out">نافذ (0)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {productsQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-8">
                  <button onClick={toggleAll} className="text-gold">
                    {allChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                </th>
                <th className="text-start px-3 py-2">المنتج</th>
                <th className="text-start px-3 py-2 hidden md:table-cell">SKU</th>
                <th className="text-start px-3 py-2 hidden lg:table-cell">التصنيف</th>
                <th className="text-start px-3 py-2">الكمية</th>
                <th className="text-start px-3 py-2">التكلفة</th>
                <th className="text-start px-3 py-2 hidden md:table-cell">الموردون</th>
                <th className="text-start px-3 py-2">النوع</th>
                <th className="text-start px-3 py-2 w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const qty = p.current_qty ?? 0;
                const cat = (catsQ.data ?? []).find((c) => c.id === p.category_id);
                return (
                  <tr key={p.id} className={`border-t border-white/5 hover:bg-white/[0.03] ${selected.has(p.id) ? "bg-gold/5" : ""}`}>
                    <td className="px-3 py-2">
                      <button onClick={() => toggleOne(p.id)} className="text-gold">
                        {selected.has(p.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to="/admin/inventory/product/$sku"
                        params={{ sku: p.sku }}
                        className="flex items-center gap-2 hover:text-gold transition"
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt="" loading="lazy" className="w-8 h-8 object-cover rounded border border-white/10" />
                        ) : <span className="w-8 h-8 grid place-items-center text-base">🐟</span>}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name_ar}</div>
                          {!p.is_active && <span className="text-[9px] text-muted-foreground">معطّل</span>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] hidden md:table-cell" dir="ltr">{p.sku}</td>
                    <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">{cat?.name_ar ?? p.category ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={qty === 0 ? "text-red-300" : qty <= 3 ? "text-amber-300" : ""}>{qty}</span>
                    </td>
                    <td className="px-3 py-2 font-mono">{p.cost != null ? SAR(Number(p.cost)) : "—"}</td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <button onClick={() => setLinksOpen(p)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold">
                        <Badge variant="outline" className="text-[10px] border-white/20">
                          {linksCountQ.data?.get(p.id) ?? 0}
                        </Badge>
                        ربط
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] border-white/20">{p.restock_type ?? "—"}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(p)}>
                          <Pencil size={12} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-red-400"
                          onClick={() => { if (confirm(`حذف "${p.name_ar}"؟`)) delM.mutate(p.id); }}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky bulk bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-background/95 backdrop-blur">
          <div className="max-w-6xl mx-auto p-3 flex items-center gap-3 text-sm" dir="rtl">
            <Badge variant="outline" className="border-gold/40 text-gold">{selected.size} محدد</Badge>
            <Button size="sm" onClick={() => setBulkOpen(true)} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
              <Wand2 size={14} className="ml-1" /> تعديل جماعي
            </Button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X size={12} /> إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <ProductDialog
          product={editing}
          categories={catsQ.data ?? []}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["aqh_products_admin"] })}
        />
      )}

      {bulkOpen && (
        <BulkDialog
          ids={Array.from(selected)}
          categories={catsQ.data ?? []}
          suppliers={suppliersQ.data ?? []}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setSelected(new Set());
            qc.invalidateQueries({ queryKey: ["aqh_products_admin"] });
            qc.invalidateQueries({ queryKey: ["aqh_ps_counts"] });
          }}
        />
      )}

      {linksOpen && (
        <LinksDialog
          product={linksOpen}
          suppliers={suppliersQ.data ?? []}
          onClose={() => setLinksOpen(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["aqh_ps_counts"] })}
        />
      )}
    </div>
  );
}

/* ---------- Product create/edit dialog ---------- */

function ProductDialog({
  product, categories, onClose, onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    sku: product?.sku ?? "",
    name_ar: product?.name_ar ?? "",
    category_id: product?.category_id ? String(product.category_id) : "",
    image_url: product?.image_url ?? "",
    current_qty: product?.current_qty ?? 0,
    cost: product?.cost ?? 0,
    is_active: product?.is_active ?? true,
    restock_type: product?.restock_type ?? "supplier",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name_ar.trim() || !form.sku.trim()) {
      toast.error("الاسم والـ SKU مطلوبان"); return;
    }
    setSaving(true);
    const payload = {
      sku: form.sku.trim(),
      name_ar: form.name_ar.trim(),
      category_id: form.category_id ? Number(form.category_id) : null,
      category: form.category_id
        ? categories.find((c) => c.id === Number(form.category_id))?.name_ar ?? null
        : null,
      image_url: form.image_url.trim() || null,
      current_qty: Number(form.current_qty) || 0,
      cost: Number(form.cost) || 0,
      is_active: form.is_active,
      restock_type: form.restock_type,
    };
    const { error } = product
      ? await supabase.from("aqh_products").update(payload).eq("id", product.id)
      : await supabase.from("aqh_products").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(product ? "تم التحديث" : "تمت الإضافة");
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>{product ? "تعديل منتج" : "منتج جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Field label="SKU" required>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} dir="ltr" />
            </Field>
            <Field label="الكمية الحالية">
              <Input type="number" value={form.current_qty} onChange={(e) => setForm({ ...form, current_qty: parseInt(e.target.value || "0", 10) })} />
            </Field>
          </div>
          <Field label="الاسم بالعربية" required>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="التصنيف">
              <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="نوع التوريد">
              <Select value={form.restock_type} onValueChange={(v) => setForm({ ...form, restock_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">مورد</SelectItem>
                  <SelectItem value="inventory">داخلي</SelectItem>
                  <SelectItem value="hidden">مخفي</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="التكلفة (ر.س)">
              <Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value || "0") })} />
            </Field>
            <Field label="رابط الصورة">
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} dir="ltr" placeholder="https://…" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            نشط
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
            {saving ? <Loader2 className="animate-spin" size={14} /> : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Bulk edit dialog ---------- */

function BulkDialog({
  ids, categories, suppliers, onClose, onDone,
}: {
  ids: number[]; categories: Category[]; suppliers: Supplier[];
  onClose: () => void; onDone: () => void;
}) {
  const [catId, setCatId] = useState<string>("");
  const [restockType, setRestockType] = useState<string>("");
  const [isActive, setIsActive] = useState<string>(""); // "", "true", "false"
  const [costPct, setCostPct] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function run() {
    setSaving(true);
    const args: Record<string, unknown> = { p_ids: ids };
    if (catId) args.p_category_id = Number(catId);
    if (restockType) args.p_restock_type = restockType;
    if (isActive !== "") args.p_is_active = isActive === "true";
    if (costPct) args.p_cost_pct = Number(costPct);
    if (supplierId) args.p_supplier_id = supplierId;
    const { error } = await supabase.rpc("aqh_bulk_update_products", args as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم تحديث ${ids.length} منتج`);
    onDone(); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تعديل جماعي · {ids.length} منتج</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200 flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5" />
            <span>اترك الحقل فارغاً لتجاوز تعديله. تأكد قبل التطبيق.</span>
          </div>

          <Field label="نقل لتصنيف">
            <Select value={catId || "none"} onValueChange={(v) => setCatId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون تغيير</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="نوع التوريد">
            <Select value={restockType || "none"} onValueChange={(v) => setRestockType(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون تغيير</SelectItem>
                <SelectItem value="supplier">مورد</SelectItem>
                <SelectItem value="inventory">داخلي</SelectItem>
                <SelectItem value="hidden">مخفي</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="الحالة">
            <Select value={isActive || "none"} onValueChange={(v) => setIsActive(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون تغيير</SelectItem>
                <SelectItem value="true">تفعيل</SelectItem>
                <SelectItem value="false">تعطيل</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="تعديل التكلفة بنسبة % (مثلاً 10 لزيادة 10%، أو -5 لخصم)">
            <Input type="number" step="0.1" value={costPct} onChange={(e) => setCostPct(e.target.value)} placeholder="0" />
          </Field>

          <Field label="إضافة/ربط مورد">
            <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={run} disabled={saving} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
            {saving ? <Loader2 className="animate-spin" size={14} /> : "تطبيق على الكل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Product ↔ suppliers links dialog ---------- */

function LinksDialog({
  product, suppliers, onClose, onChanged,
}: {
  product: Product; suppliers: Supplier[];
  onClose: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const linksQ = useQuery({
    queryKey: ["aqh_ps_for", product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_product_suppliers")
        .select("id,finance_supplier_id,cost,supplier_sku,is_preferred,lead_time_days")
        .eq("product_id", product.id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [pickSupplier, setPickSupplier] = useState<string>("");
  const [cost, setCost] = useState<string>("");
  const [supSku, setSupSku] = useState<string>("");

  async function addLink() {
    if (!pickSupplier) { toast.error("اختر مورد"); return; }
    const { error } = await supabase.from("aqh_product_suppliers").insert({
      product_id: product.id,
      finance_supplier_id: pickSupplier,
      cost: cost ? Number(cost) : null,
      supplier_sku: supSku.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    setPickSupplier(""); setCost(""); setSupSku("");
    qc.invalidateQueries({ queryKey: ["aqh_ps_for", product.id] });
    onChanged();
  }

  async function removeLink(id: number) {
    const { error } = await supabase.from("aqh_product_suppliers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["aqh_ps_for", product.id] });
    onChanged();
  }

  async function togglePreferred(id: number, val: boolean) {
    // reset others if making this preferred
    if (val) {
      await supabase.from("aqh_product_suppliers")
        .update({ is_preferred: false }).eq("product_id", product.id);
    }
    const { error } = await supabase.from("aqh_product_suppliers")
      .update({ is_preferred: val }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["aqh_ps_for", product.id] });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-sm">موردو "{product.name_ar}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {linksQ.isLoading ? (
            <div className="text-xs text-muted-foreground text-center py-4">جارٍ التحميل…</div>
          ) : (linksQ.data ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">لا يوجد موردون مرتبطون</div>
          ) : (
            <div className="space-y-1">
              {(linksQ.data ?? []).map((l: any) => {
                const sup = suppliers.find((s) => s.id === l.finance_supplier_id);
                return (
                  <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 text-[12px]">
                    <span className="flex-1">{sup?.name_ar ?? "مورد محذوف"}</span>
                    <span className="text-muted-foreground font-mono text-[10px]" dir="ltr">{l.supplier_sku ?? "—"}</span>
                    <span className="font-mono text-[11px]">{l.cost != null ? SAR(Number(l.cost)) : "—"}</span>
                    <label className="text-[10px] inline-flex items-center gap-1">
                      <input type="checkbox" checked={!!l.is_preferred} onChange={(e) => togglePreferred(l.id, e.target.checked)} />
                      مفضّل
                    </label>
                    <button onClick={() => removeLink(l.id)} className="text-muted-foreground hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="text-[11px] text-muted-foreground">إضافة مورد جديد</div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={pickSupplier || "none"} onValueChange={(v) => setPickSupplier(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="اختر مورد" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="SKU عند المورد" value={supSku} onChange={(e) => setSupSku(e.target.value)} dir="ltr" />
              <Input placeholder="التكلفة" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <Button size="sm" onClick={addLink} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
              <Plus size={12} className="ml-1" /> ربط
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] text-muted-foreground mb-1">{label}{required && <span className="text-red-400"> *</span>}</label>
      {children}
    </div>
  );
}
