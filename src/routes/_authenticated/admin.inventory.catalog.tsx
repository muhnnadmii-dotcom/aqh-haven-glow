import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { toast } from "sonner";
import {
  Search, Plus, Minus, Loader2, ArrowRight, Truck, AlertTriangle,
  ShoppingCart, X, CheckCircle2, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/inventory/catalog")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "staff"]).limit(1).maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
    return { role: data.role as "admin" | "staff", userId: user.id };
  },
  component: SupplierCatalogPage,
});

type SupplierProduct = {
  id: number;
  supplier_key: string;
  supplier_name: string;
  name: string;
  item_no: string | null;
  barcode: string | null;
  cost: number | null;
  needs_review: boolean;
  is_active: boolean;
};

const VAT_RATE = 0.15;
const SAR = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n) + " ر.س";

function SupplierCatalogPage() {
  const qc = useQueryClient();
  const productsQ = useQuery({
    queryKey: ["aqh_supplier_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_supplier_products" as any)
        .select("id,supplier_key,supplier_name,name,item_no,barcode,cost,needs_review,is_active")
        .eq("is_active", true)
        .eq("needs_review", false)
        .order("supplier_key", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = (data as unknown as SupplierProduct[]) ?? [];
      // Deduplicate by (supplier_key, normalized name) — keep first occurrence
      const seen = new Set<string>();
      return rows.filter((p) => {
        const key = `${p.supplier_key}::${p.name.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });

  const brands = useMemo(() => {
    const m = new Map<string, string>();
    (productsQ.data ?? []).forEach((p) => m.set(p.supplier_key, p.supplier_name));
    return Array.from(m.entries()).map(([key, name]) => ({ key, name }));
  }, [productsQ.data]);


  const [supplier, setSupplier] = useState<string>("");
  const [q, setQ] = useState("");
  // cart: id -> qty
  const [cart, setCart] = useState<Record<number, number>>({});
  const [employeeName, setEmployeeName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Auto-select first supplier
  const activeSupplier = supplier || brands[0]?.key || "";

  const cartSupplierKey = useMemo(() => {
    const ids = Object.keys(cart).map(Number);
    if (ids.length === 0) return null;
    const first = (productsQ.data ?? []).find((p) => p.id === ids[0]);
    return first?.supplier_key ?? null;
  }, [cart, productsQ.data]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (productsQ.data ?? []).filter((p) => {
      if (activeSupplier && p.supplier_key !== activeSupplier) return false;
      if (!text) return true;
      return (
        p.name.toLowerCase().includes(text) ||
        (p.item_no ?? "").toLowerCase().includes(text) ||
        (p.barcode ?? "").toLowerCase().includes(text)
      );
    });
  }, [productsQ.data, activeSupplier, q]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = (productsQ.data ?? []).find((x) => x.id === Number(id));
        return p ? { p, qty } : null;
      })
      .filter(Boolean) as { p: SupplierProduct; qty: number }[];
  }, [cart, productsQ.data]);

  const subtotal = cartItems.reduce((s, it) => s + (Number(it.p.cost) || 0) * it.qty, 0);
  const vat = +(subtotal * VAT_RATE).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);
  const distinct = cartItems.length;
  const totalQty = cartItems.reduce((s, it) => s + it.qty, 0);

  function setQty(id: number, qty: number, supplierKey: string) {
    setCart((prev) => {
      const next = { ...prev };
      // If switching supplier and cart not empty, block via toast
      if (cartSupplierKey && cartSupplierKey !== supplierKey && qty > 0) {
        toast.error("لا يمكن خلط منتجات من موردين مختلفين في طلب واحد");
        return prev;
      }
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  const submitM = useMutation({
    mutationFn: async () => {
      if (cartItems.length === 0) throw new Error("السلة فارغة");
      const sk = cartItems[0].p.supplier_key;
      const items = cartItems.map(({ p, qty }) => ({
        sku: p.item_no || p.barcode || String(p.id),
        name_ar: p.name,
        qty,
        cost: Number(p.cost) || 0,
      }));
      const { error } = await supabase.from("aqh_restock_requests").insert({
        items: items as unknown as never,
        items_count: items.length,
        request_kind: "order",
        status: "new",
        employee_name: employeeName.trim() || null,
        notes: notes.trim() || null,
        source: "supplier_catalog",
        supplier_key: sk,
        subtotal,
        vat,
        total,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["aqh_restock_requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  function reset() {
    setCart({}); setNotes(""); setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className="py-16 text-center space-y-4" dir="rtl">
        <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
        <div className="text-lg font-semibold">✅ تم إرسال طلب التوريد</div>
        <p className="text-sm text-muted-foreground">المجموع: {SAR(total)}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">طلب جديد</Button>
          <Link to="/admin/inventory" className="inline-flex items-center px-4 py-2 rounded-lg text-sm bg-white/5 border border-white/10 hover:bg-white/10">
            <ArrowRight size={14} className="ml-1" /> رجوع للمخزون
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-32" dir="rtl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <Truck size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">كاتلوج الموردين</h1>
          <p className="text-xs text-muted-foreground">اختر منتجات من نفس المورد ثم أنشئ طلب توريد بسعر شامل الضريبة</p>
        </div>
        <Link to="/admin/inventory" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowRight size={12} /> المخزون
        </Link>
      </header>

      {/* Supplier tabs */}
      <div className="flex flex-wrap gap-2">
        {brands.map((s) => (
          <button
            key={s.key}
            onClick={() => setSupplier(s.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              activeSupplier === s.key
                ? "bg-gold/20 text-gold border-gold/40"
                : "bg-white/[0.03] text-muted-foreground border-white/10 hover:border-white/25"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم أو رقم المنتج أو الباركود…"
          className="pr-9"
        />
      </div>

      {productsQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">لا توجد منتجات.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-3 py-2">المنتج</th>
                <th className="text-start px-3 py-2 hidden md:table-cell">Item No</th>
                <th className="text-start px-3 py-2 hidden lg:table-cell">Barcode</th>
                <th className="text-start px-3 py-2">السعر</th>
                <th className="text-start px-3 py-2">الكمية</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const qty = cart[p.id] ?? 0;
                return (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.needs_review && (
                          <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300 bg-amber-500/10">
                            <AlertTriangle size={9} className="ml-0.5" /> يحتاج مراجعة
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] hidden md:table-cell" dir="ltr">{p.item_no ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[11px] hidden lg:table-cell" dir="ltr">{p.barcode ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{p.cost != null ? SAR(Number(p.cost)) : "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                          onClick={() => setQty(p.id, qty - 1, p.supplier_key)} disabled={qty <= 0}>
                          <Minus size={12} />
                        </Button>
                        <Input
                          type="number" min="0" value={qty}
                          onChange={(e) => setQty(p.id, Math.max(0, parseInt(e.target.value || "0", 10)), p.supplier_key)}
                          className="h-7 w-12 text-center px-1 text-[11px]"
                        />
                        <Button size="sm" variant="outline"
                          className="h-7 w-7 p-0 bg-gold/10 border-gold/30 text-gold hover:bg-gold/20 hover:text-gold"
                          onClick={() => setQty(p.id, qty + 1, p.supplier_key)}>
                          <Plus size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky cart footer */}
      {distinct > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-background/95 backdrop-blur">
          <div className="max-w-6xl mx-auto p-3 space-y-2" dir="rtl">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <ShoppingCart size={16} className="text-gold" />
              <span><span className="text-gold font-semibold">{distinct}</span> منتج · <span className="text-gold font-semibold">{totalQty}</span> قطعة</span>
              {cartSupplierKey && (
                <Badge variant="outline" className="text-[10px] border-gold/30 text-gold">
                  {brands.find((s) => s.key === cartSupplierKey)?.name}
                </Badge>
              )}
              <span className="text-muted-foreground">·</span>
              <span>المجموع: <span className="font-mono">{SAR(subtotal)}</span></span>
              <span className="text-muted-foreground">·</span>
              <span>الضريبة 15%: <span className="font-mono">{SAR(vat)}</span></span>
              <span className="text-muted-foreground">·</span>
              <span className="text-gold">الإجمالي: <span className="font-mono font-semibold">{SAR(total)}</span></span>
              <button onClick={() => setCart({})} className="ms-auto text-[11px] text-muted-foreground hover:text-red-400 inline-flex items-center gap-1">
                <Trash2 size={11} /> تفريغ
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="اسم الموظف (اختياري)" className="w-44 h-9" />
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظة (اختياري)" className="flex-1 h-9 min-w-[180px]" />
              <Button onClick={() => submitM.mutate()} disabled={submitM.isPending}
                className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
                {submitM.isPending ? <Loader2 className="animate-spin" size={14} /> : "إنشاء طلب التوريد"}
              </Button>
            </div>
            {/* Cart preview */}
            <details className="text-[11px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">عرض السلة ({distinct})</summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {cartItems.map(({ p, qty }) => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1 rounded bg-white/5">
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="font-mono text-muted-foreground">×{qty}</span>
                    <span className="font-mono w-20 text-end">{SAR((Number(p.cost) || 0) * qty)}</span>
                    <button onClick={() => setQty(p.id, 0, p.supplier_key)} className="text-muted-foreground hover:text-red-400">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
