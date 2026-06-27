import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { seedAqhProducts } from "@/lib/aqh-inventory.functions";
import { toast } from "sonner";
import {
  Package, Search, Plus, Minus, Download, Loader2, Truck,
  ClipboardList, Sparkles, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "staff"])
      .limit(1)
      .maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
    return { role: data.role as "admin" | "staff", userId: user.id };
  },
  component: InventoryPage,
});

type RestockType = "supplier" | "inventory" | "hidden";
type RequestKind = "order" | "report";
type RestockStatus = "new" | "ordered" | "received" | "resolved";

type Product = {
  id: number;
  sku: string;
  name_ar: string;
  category: string | null;
  image_url: string | null;
  current_qty: number;
  cost: number;
  is_active: boolean;
  restock_type: RestockType;
};

type RestockItem = { sku: string; name_ar: string; qty: number; cost?: number };

type RestockRequest = {
  id: number;
  employee_name: string | null;

  created_by: string | null;
  request_kind: RequestKind;
  status: RestockStatus;
  items: RestockItem[];
  items_count: number;
  notes: string | null;
  created_at: string;
  source: string | null;
  supplier_key: string | null;
  subtotal: number | null;
  vat: number | null;
  total: number | null;
};

const STATUS_LABEL: Record<RestockStatus, string> = {
  new: "جديد",
  ordered: "تم الطلب",
  received: "تم الاستلام",
  resolved: "تم الحل",
};

const KIND_LABEL: Record<RequestKind, string> = {
  order: "طلب توريد",
  report: "بلاغ نفاد",
};

function statusBadgeClass(s: RestockStatus): string {
  if (s === "new") return "bg-gold/15 text-gold border border-gold/40";
  if (s === "ordered") return "bg-sky-500/15 text-sky-300 border border-sky-500/30";
  return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
}

function useProducts(types: RestockType[]) {
  return useQuery({
    queryKey: ["aqh_products", "active", ...types],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products")
        .select("id, sku, name_ar, category, image_url, current_qty, cost, is_active, restock_type")
        .eq("is_active", true)
        .in("restock_type", types)
        .order("name_ar", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        restock_type: (p.restock_type ?? "supplier") as RestockType,
      })) as Product[];
    },
  });
}

function useDisplayName(userId: string) {
  return useQuery({
    queryKey: ["profile_display_name", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      return (data?.full_name ?? "").trim();
    },
  });
}

function InventoryPage() {
  const { role, userId } = Route.useRouteContext();
  const isAdmin = role === "admin";
  const nameQ = useDisplayName(userId);
  const displayName = nameQ.data ?? "";

  return (
    <div className="space-y-5" dir="rtl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <Package size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">المخزون</h1>
          <p className="text-xs text-muted-foreground">طلبات التوريد وبلاغات نفاد المخزون</p>
        </div>
        <Link
          to="/admin/inventory/catalog"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25"
        >
          <Truck size={14} /> كاتلوج الموردين
        </Link>
      </header>

      <Tabs defaultValue="supply" dir="rtl">
        <TabsList>
          <TabsTrigger value="supply">طلب توريد</TabsTrigger>
          <TabsTrigger value="report">جرد / تبليغ نفاد</TabsTrigger>
          <TabsTrigger value="list">الطلبات</TabsTrigger>
        </TabsList>
        <TabsContent value="supply" className="mt-4">
          <SupplyTab isAdmin={isAdmin} displayName={displayName} />
        </TabsContent>
        <TabsContent value="report" className="mt-4">
          <ReportTab isAdmin={isAdmin} displayName={displayName} />
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          <RequestsListTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Shared bits ---------------- */

function CategoryChips({
  categories, value, onChange,
}: { categories: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange("all")}
        className={`text-xs px-3 py-1.5 rounded-full border transition ${
          value === "all"
            ? "bg-gold/20 text-gold border-gold/40"
            : "bg-white/[0.03] text-muted-foreground border-white/10 hover:border-white/25"
        }`}
      >
        الكل
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            value === c
              ? "bg-gold/20 text-gold border-gold/40"
              : "bg-white/[0.03] text-muted-foreground border-white/10 hover:border-white/25"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function RestockTypeAdmin({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <Select
      value={product.restock_type}
      onValueChange={async (v) => {
        setSaving(true);
        const { error } = await supabase
          .from("aqh_products")
          .update({ restock_type: v })
          .eq("id", product.id);
        setSaving(false);
        if (error) toast.error(error.message);
        else { toast.success("تم تحديث التصنيف"); onChanged(); }
      }}
    >
      <SelectTrigger className="h-6 px-2 py-0 text-[10px] w-auto min-w-[88px] bg-white/[0.03] border-white/10">
        {saving ? <Loader2 size={10} className="animate-spin" /> : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="supplier">supplier</SelectItem>
        <SelectItem value="inventory">inventory</SelectItem>
        <SelectItem value="hidden">hidden</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ProductThumb({ p }: { p: Product }) {
  return (
    <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center text-xl">
      {p.image_url ? (
        <img src={p.image_url} alt={p.name_ar} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden>🐟</span>
      )}
    </div>
  );
}

function SeedBanner({ onSeeded }: { onSeeded: () => void }) {
  const seedFn = useServerFn(seedAqhProducts);
  const seedM = useMutation({
    mutationFn: async () => seedFn(),
    onSuccess: (res) => { toast.success(`تمت تعبئة ${res.inserted} منتج`); onSeeded(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل تعبئة الكاتالوج"),
  });
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 flex items-center justify-between gap-3">
      <div className="text-sm">
        <div className="font-medium">الكاتالوج فارغ</div>
        <div className="text-xs text-muted-foreground">يمكنك تعبئة المنتجات من بيانات السلة دفعة واحدة.</div>
      </div>
      <Button
        onClick={() => seedM.mutate()}
        disabled={seedM.isPending}
        className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30"
      >
        {seedM.isPending ? <Loader2 className="animate-spin" size={14} /> : (<><Sparkles size={14} className="ml-1" /> تعبئة الكاتالوج</>)}
      </Button>
    </div>
  );
}

/* ---------------- TAB 1: Supply request ---------------- */

function SupplyTab({ isAdmin, displayName }: { isAdmin: boolean; displayName: string }) {
  const qc = useQueryClient();
  const productsQ = useProducts(["supplier"]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [employeeName, setEmployeeName] = useState(displayName);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { if (!employeeName && displayName) setEmployeeName(displayName); }, [displayName]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    (productsQ.data ?? []).forEach((p) => p.category && s.add(p.category));
    return Array.from(s).sort();
  }, [productsQ.data]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (productsQ.data ?? []).filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!text) return true;
      return p.name_ar.toLowerCase().includes(text) || p.sku.toLowerCase().includes(text);
    });
  }, [productsQ.data, q, category]);

  const totalQty = Object.values(qtyMap).reduce((s, n) => s + (n || 0), 0);
  const distinct = Object.values(qtyMap).filter((n) => n > 0).length;

  function setQty(sku: string, n: number) {
    setQtyMap((prev) => {
      const next = { ...prev };
      if (n <= 0) delete next[sku];
      else next[sku] = n;
      return next;
    });
  }

  const submitM = useMutation({
    mutationFn: async () => {
      const items: RestockItem[] = (productsQ.data ?? [])
        .filter((p) => (qtyMap[p.sku] ?? 0) > 0)
        .map((p) => ({ sku: p.sku, name_ar: p.name_ar, qty: qtyMap[p.sku] }));
      if (items.length === 0) throw new Error("اختر منتجاً واحداً على الأقل");
      const { error } = await supabase.from("aqh_restock_requests").insert({
        items: items as unknown as never,
        items_count: items.length,
        request_kind: "order",
        status: "new",
        employee_name: employeeName.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["aqh_restock_requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  function reset() {
    setQtyMap({}); setNotes(""); setSubmitted(false);
  }

  const isEmpty = !productsQ.isLoading && (productsQ.data ?? []).length === 0;

  if (submitted) {
    return (
      <div className="py-16 text-center space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
        <div className="text-lg font-semibold">✅ تم إرسال الطلب</div>
        <p className="text-sm text-muted-foreground">شكراً، تم تسجيل طلب التوريد بنجاح.</p>
        <Button onClick={reset} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
          طلب جديد
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {isEmpty && isAdmin && <SeedBanner onSeeded={() => qc.invalidateQueries({ queryKey: ["aqh_products"] })} />}

      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم المنتج أو SKU…"
          className="pr-9"
        />
      </div>

      {categories.length > 0 && (
        <CategoryChips categories={categories} value={category} onChange={setCategory} />
      )}

      {productsQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">لا توجد منتجات مطابقة.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const qty = qtyMap[p.sku] ?? 0;
            return (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex gap-3 items-center">
                <ProductThumb p={p} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm leading-tight line-clamp-2">{p.name_ar}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{p.category ?? "—"} · متوفر: {p.current_qty}</span>
                    <Badge variant="outline" className="text-[9px]" dir="ltr">{p.sku}</Badge>
                    {isAdmin && <RestockTypeAdmin product={p} onChanged={() => productsQ.refetch()} />}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={() => setQty(p.sku, qty - 1)} disabled={qty <= 0}>
                    <Minus size={14} />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    value={qty}
                    onChange={(e) => setQty(p.sku, Math.max(0, parseInt(e.target.value || "0", 10)))}
                    className="h-9 w-14 text-center px-1"
                  />
                  <Button size="sm" variant="outline" className="h-9 w-9 p-0 bg-gold/10 border-gold/30 text-gold hover:bg-gold/20 hover:text-gold" onClick={() => setQty(p.sku, qty + 1)}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalQty > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-background/95 backdrop-blur p-3">
          <div className="max-w-5xl mx-auto flex items-center gap-3" dir="rtl">
            <div className="text-sm flex-1">
              <span className="text-gold font-semibold">{distinct}</span> منتج ·{" "}
              <span className="text-gold font-semibold">{totalQty}</span> قطعة
            </div>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="اسم الموظف (اختياري)"
              className="hidden sm:block w-44 h-9"
            />
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظة (اختياري)"
              className="hidden md:block flex-1 h-9"
            />
            <Button
              onClick={() => submitM.mutate()}
              disabled={submitM.isPending}
              className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30"
            >
              {submitM.isPending ? <Loader2 className="animate-spin" size={14} /> : "إرسال الطلب"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- TAB 2: Inventory / low-stock report ---------------- */

function ReportTab({ isAdmin, displayName }: { isAdmin: boolean; displayName: string }) {
  const qc = useQueryClient();
  const productsQ = useProducts(["supplier", "inventory"]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  // qty=0 means "نفذ" (out), >0 means "قليل" with remaining count
  const [state, setState] = useState<Record<string, { qty: number; name_ar: string }>>({});
  const [employeeName, setEmployeeName] = useState(displayName);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { if (!employeeName && displayName) setEmployeeName(displayName); }, [displayName]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    (productsQ.data ?? []).forEach((p) => p.category && s.add(p.category));
    return Array.from(s).sort();
  }, [productsQ.data]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (productsQ.data ?? []).filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!text) return true;
      return p.name_ar.toLowerCase().includes(text) || p.sku.toLowerCase().includes(text);
    });
  }, [productsQ.data, q, category]);

  function toggleOut(p: Product) {
    setState((prev) => {
      const next = { ...prev };
      if (next[p.sku] && next[p.sku].qty === 0) delete next[p.sku];
      else next[p.sku] = { qty: 0, name_ar: p.name_ar };
      return next;
    });
  }
  function setLowQty(p: Product, n: number) {
    setState((prev) => {
      const next = { ...prev };
      if (n <= 0) {
        // 0 means "نفذ" — keep entry with qty 0; if user clears, drop
        if (next[p.sku] && next[p.sku].qty > 0) next[p.sku] = { qty: 0, name_ar: p.name_ar };
        return next;
      }
      next[p.sku] = { qty: n, name_ar: p.name_ar };
      return next;
    });
  }
  function clear(sku: string) {
    setState((prev) => { const n = { ...prev }; delete n[sku]; return n; });
  }

  const selected = Object.entries(state);
  const totalSelected = selected.length;

  const submitM = useMutation({
    mutationFn: async () => {
      if (selected.length === 0) throw new Error("اختر منتجاً واحداً على الأقل");
      const items: RestockItem[] = selected.map(([sku, v]) => ({ sku, name_ar: v.name_ar, qty: v.qty }));
      const { error } = await supabase.from("aqh_restock_requests").insert({
        items: items as unknown as never,
        items_count: items.length,
        request_kind: "report",
        status: "new",
        employee_name: employeeName.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["aqh_restock_requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  function reset() { setState({}); setNotes(""); setSubmitted(false); }

  const isEmpty = !productsQ.isLoading && (productsQ.data ?? []).length === 0;

  if (submitted) {
    return (
      <div className="py-16 text-center space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
        <div className="text-lg font-semibold">✅ تم إرسال البلاغ</div>
        <p className="text-sm text-muted-foreground">تم تسجيل بلاغ نفاد المخزون بنجاح.</p>
        <Button onClick={reset} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
          بلاغ جديد
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {isEmpty && isAdmin && <SeedBanner onSeeded={() => qc.invalidateQueries({ queryKey: ["aqh_products"] })} />}

      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم المنتج أو SKU…"
          className="pr-9"
        />
      </div>

      {categories.length > 0 && (
        <CategoryChips categories={categories} value={category} onChange={setCategory} />
      )}

      {productsQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">لا توجد منتجات مطابقة.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const entry = state[p.sku];
            const isOut = entry && entry.qty === 0;
            const isLow = entry && entry.qty > 0;
            return (
              <div key={p.id} className={`rounded-xl border p-3 flex gap-3 items-center transition ${
                isOut ? "border-red-500/40 bg-red-500/5"
                : isLow ? "border-amber-500/40 bg-amber-500/5"
                : "border-white/10 bg-white/[0.02]"
              }`}>
                <ProductThumb p={p} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm leading-tight line-clamp-2">{p.name_ar}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{p.category ?? "—"} · متوفر: {p.current_qty}</span>
                    <Badge variant="outline" className="text-[9px]" dir="ltr">{p.sku}</Badge>
                    {p.restock_type === "inventory" ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">جرد</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">توريد</span>
                    )}
                    {isAdmin && <RestockTypeAdmin product={p} onChanged={() => productsQ.refetch()} />}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleOut(p)}
                    className={`h-9 ${isOut ? "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30" : ""}`}
                  >
                    نفذ
                  </Button>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">قليل:</span>
                    <Input
                      type="number"
                      min="0"
                      value={isLow ? entry!.qty : ""}
                      onChange={(e) => setLowQty(p, Math.max(0, parseInt(e.target.value || "0", 10)))}
                      placeholder="—"
                      className="h-9 w-16 text-center px-1"
                    />
                  </div>
                  {entry && (
                    <Button size="sm" variant="ghost" className="h-9 px-2 text-xs text-muted-foreground" onClick={() => clear(p.sku)}>
                      إلغاء
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalSelected > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-background/95 backdrop-blur p-3">
          <div className="max-w-5xl mx-auto flex items-center gap-3" dir="rtl">
            <div className="text-sm flex-1">
              <span className="text-gold font-semibold">{totalSelected}</span> منتج في البلاغ
            </div>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="اسم الموظف (اختياري)"
              className="hidden sm:block w-44 h-9"
            />
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظة (اختياري)"
              className="hidden md:block flex-1 h-9"
            />
            <Button
              onClick={() => submitM.mutate()}
              disabled={submitM.isPending}
              className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30"
            >
              {submitM.isPending ? <Loader2 className="animate-spin" size={14} /> : "إرسال البلاغ"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- TAB 3: Requests list ---------------- */

function RequestsListTab() {
  const qc = useQueryClient();
  const [kindF, setKindF] = useState<RequestKind | "all">("all");
  const [statusF, setStatusF] = useState<RestockStatus | "all">("all");
  const [sourceF, setSourceF] = useState<"all" | "internal" | "supplier_catalog">("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const requestsQ = useQuery({
    queryKey: ["aqh_restock_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_restock_requests")
        .select("id, employee_name, created_by, request_kind, status, items, items_count, notes, created_at, source, supplier_key, subtotal, vat, total" as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        items: (Array.isArray(r.items) ? r.items : []) as RestockItem[],
        status: (r.status ?? "new") as RestockStatus,
        request_kind: (r.request_kind ?? "order") as RequestKind,
      })) as RestockRequest[];
    },
  });

  const suppliersQ = useQuery({
    queryKey: ["aqh_supplier_names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_supplier_products" as any)
        .select("supplier_key,supplier_name");
      if (error) throw error;
      const m: Record<string, string> = {};
      ((data as any[]) ?? []).forEach((r) => { m[r.supplier_key] = r.supplier_name; });
      return m;
    },
  });
  const supplierNames = suppliersQ.data ?? {};

  const filtered = useMemo(() => {
    return (requestsQ.data ?? []).filter((r) => {
      if (kindF !== "all" && r.request_kind !== kindF) return false;
      if (statusF !== "all" && r.status !== statusF) return false;
      if (sourceF === "internal" && r.source === "supplier_catalog") return false;
      if (sourceF === "supplier_catalog" && r.source !== "supplier_catalog") return false;
      return true;
    });
  }, [requestsQ.data, kindF, statusF, sourceF]);

  const statusM = useMutation({
    mutationFn: async (args: { id: number; next: RestockStatus }) => {
      const { error } = await supabase
        .from("aqh_restock_requests")
        .update({ status: args.next })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      qc.invalidateQueries({ queryKey: ["aqh_restock_requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل التحديث"),
  });

  function exportCsv(r: RestockRequest) {
    const hasCost = r.items.some((it) => it.cost != null);
    const headers = hasCost
      ? ["SKU", "المنتج", "الكمية", "التكلفة", "الإجمالي"]
      : ["SKU", "المنتج", "الكمية"];
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows = r.items.map((it) => {
      const base = [it.sku, it.name_ar, String(it.qty)];
      if (hasCost) {
        const c = Number(it.cost) || 0;
        base.push(c.toFixed(2), (c * it.qty).toFixed(2));
      }
      return base.map(esc).join(",");
    });
    let csv = "\uFEFF" + headers.map(esc).join(",") + "\n" + rows.join("\n") + "\n";
    if (hasCost && r.total != null) {
      csv += "\n";
      csv += `${esc("المجموع قبل الضريبة")},${esc(String((r.subtotal ?? 0).toFixed(2)))}\n`;
      csv += `${esc("الضريبة 15%")},${esc(String((r.vat ?? 0).toFixed(2)))}\n`;
      csv += `${esc("الإجمالي")},${esc(String((r.total ?? 0).toFixed(2)))}\n`;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restock-${r.id}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const kindChips: Array<{ v: RequestKind | "all"; label: string }> = [
    { v: "all", label: "الكل" },
    { v: "order", label: "طلبات توريد" },
    { v: "report", label: "بلاغات نفاد" },
  ];
  const sourceChips: Array<{ v: "all" | "internal" | "supplier_catalog"; label: string }> = [
    { v: "all", label: "كل المصادر" },
    { v: "internal", label: "مخزون داخلي" },
    { v: "supplier_catalog", label: "كاتلوج موردين" },
  ];
  const statusChips: Array<{ v: RestockStatus | "all"; label: string }> = [
    { v: "all", label: "كل الحالات" },
    { v: "new", label: "جديد" },
    { v: "ordered", label: "تم الطلب" },
    { v: "received", label: "تم الاستلام" },
    { v: "resolved", label: "تم الحل" },
  ];

  const SAR = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n) + " ر.س";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {kindChips.map((c) => (
            <button
              key={c.v}
              onClick={() => setKindF(c.v)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                kindF === c.v ? "bg-gold/20 text-gold border-gold/40" : "bg-white/[0.03] text-muted-foreground border-white/10 hover:border-white/25"
              }`}
            >{c.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {sourceChips.map((c) => (
            <button
              key={c.v}
              onClick={() => setSourceF(c.v)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                sourceF === c.v ? "bg-gold/15 text-gold border-gold/30" : "bg-white/[0.03] text-muted-foreground border-white/10 hover:border-white/25"
              }`}
            >{c.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {statusChips.map((c) => (
            <button
              key={c.v}
              onClick={() => setStatusF(c.v)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                statusF === c.v ? "bg-white/10 text-foreground border-white/30" : "bg-white/[0.03] text-muted-foreground border-white/10 hover:border-white/25"
              }`}
            >{c.label}</button>
          ))}
        </div>
      </div>

      {requestsQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline animate-spin" size={14} /> جارٍ التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">لا توجد طلبات.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isReport = r.request_kind === "report";
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">#{r.id}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                    isReport ? "bg-sky-500/15 text-sky-300 border-sky-500/30" : "bg-gold/10 text-gold border-gold/30"
                  }`}>
                    {isReport ? <ClipboardList size={10} /> : <Truck size={10} />}
                    {KIND_LABEL[r.request_kind]}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadgeClass(r.status)}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="text-sm">{r.employee_name?.trim() || "موظف"}</span>
                  <span className="text-[11px] text-muted-foreground" dir="ltr">
                    {new Date(r.created_at).toLocaleString("ar-SA")}
                  </span>
                  <div className="ms-auto flex items-center gap-2">
                    {r.request_kind === "order" && r.status === "new" && (
                      <Button size="sm" variant="outline" className="h-8 bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20"
                        onClick={() => statusM.mutate({ id: r.id, next: "ordered" })}>
                        تم الطلب من المورّد
                      </Button>
                    )}
                    {r.request_kind === "order" && r.status === "ordered" && (
                      <Button size="sm" variant="outline" className="h-8 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                        onClick={() => statusM.mutate({ id: r.id, next: "received" })}>
                        تم الاستلام
                      </Button>
                    )}
                    {r.request_kind === "report" && r.status === "new" && (
                      <Button size="sm" variant="outline" className="h-8 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                        onClick={() => statusM.mutate({ id: r.id, next: "resolved" })}>
                        تم الحل
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8" onClick={() => exportCsv(r)}>
                      <Download size={13} className="ml-1" /> CSV
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setExpanded(isOpen ? null : r.id)}>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.03] text-xs text-muted-foreground">
                        <tr>
                          <th className="text-right p-2 font-normal">المنتج</th>
                          <th className="text-right p-2 font-normal w-24">SKU</th>
                          <th className="text-left p-2 font-normal w-20">الكمية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.items.map((it, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="p-2">{it.name_ar}</td>
                            <td className="p-2 text-xs text-muted-foreground" dir="ltr">{it.sku}</td>
                            <td className="p-2 text-left text-gold font-medium">× {it.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {r.notes && (
                      <div className="text-xs text-muted-foreground border-t border-white/10 p-2">
                        <span className="text-foreground">ملاحظة: </span>{r.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
