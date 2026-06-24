import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { seedAqhProducts } from "@/lib/aqh-inventory.functions";
import { toast } from "sonner";
import {
  Package, Search, Plus, Minus, Trash2, Download, Loader2, ShoppingCart,
  ChevronDown, ChevronUp, Truck, ClipboardList, Sparkles,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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
    return { role: data.role as "admin" | "staff" };
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

type RestockItem = { sku: string; name_ar: string; qty: number };

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
};

const STATUS_LABEL: Record<RestockStatus, string> = {
  new: "جديد",
  ordered: "تم الطلب",
  received: "تم الاستلام",
  resolved: "تمت المعالجة",
};

const KIND_LABEL: Record<RequestKind, string> = {
  order: "طلب توريد",
  report: "بلاغ نفاد",
};

const RTYPE_LABEL: Record<RestockType, string> = {
  supplier: "يُطلب من مورّد",
  inventory: "جرد / بلاغ نفاد",
  hidden: "مخفي",
};

function statusBadgeClass(s: RestockStatus): string {
  if (s === "new") return "bg-white/10 text-foreground border border-white/15";
  if (s === "ordered") return "bg-gold/15 text-gold border border-gold/30";
  if (s === "received") return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
  return "bg-sky-500/15 text-sky-300 border border-sky-500/30";
}

function InventoryPage() {
  const { role } = Route.useRouteContext();
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <Package size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">المخزون وإعادة التوريد</h1>
          <p className="text-xs text-muted-foreground">طلبات توريد المنتجات وبلاغات نفاد المخزون</p>
        </div>
      </header>

      <Tabs defaultValue="request" dir="rtl">
        <TabsList>
          <TabsTrigger value="request">طلب توريد / بلاغ نفاد</TabsTrigger>
          <TabsTrigger value="list">الطلبات</TabsTrigger>
        </TabsList>
        <TabsContent value="request" className="mt-4">
          <RequestTab isAdmin={role === "admin"} />
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          <RequestsListTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- TAB 1: Request restock ---------------- */

function RequestTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const seedFn = useServerFn(seedAqhProducts);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [rtype, setRtype] = useState<"all" | "supplier" | "inventory">("all");
  const [cart, setCart] = useState<Record<string, RestockItem & { restock_type: RestockType }>>({});
  const [employeeName, setEmployeeName] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<RequestKind | "auto">("auto");
  const [showCart, setShowCart] = useState(false);

  const productsQ = useQuery({
    queryKey: ["aqh_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products")
        .select("id, sku, name_ar, category, image_url, current_qty, cost, is_active, restock_type")
        .eq("is_active", true)
        .neq("restock_type", "hidden")
        .order("category", { ascending: true })
        .order("name_ar", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, restock_type: (p.restock_type ?? "supplier") as RestockType })) as Product[];
    },
  });

  const seedM = useMutation({
    mutationFn: async () => seedFn(),
    onSuccess: (res) => {
      toast.success(`تمت تعبئة ${res.inserted} منتج`);
      qc.invalidateQueries({ queryKey: ["aqh_products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل تعبئة الكاتالوج"),
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    (productsQ.data ?? []).forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [productsQ.data]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (productsQ.data ?? []).filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (rtype !== "all" && p.restock_type !== rtype) return false;
      if (!text) return true;
      return (
        p.name_ar.toLowerCase().includes(text) ||
        p.sku.toLowerCase().includes(text)
      );
    });
  }, [productsQ.data, q, category, rtype]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartCount = cartItems.reduce((s, it) => s + (it.qty || 0), 0);
  const autoKind: RequestKind = useMemo(() => {
    if (cartItems.length === 0) return "order";
    return cartItems.every((it) => it.restock_type === "inventory") ? "report" : "order";
  }, [cartItems]);
  const effectiveKind: RequestKind = kind === "auto" ? autoKind : kind;

  function addToCart(p: Product) {
    setCart((prev) => {
      const cur = prev[p.sku];
      return { ...prev, [p.sku]: { sku: p.sku, name_ar: p.name_ar, restock_type: p.restock_type, qty: (cur?.qty ?? 0) + 1 } };
    });
  }
  function setQty(sku: string, qty: number) {
    setCart((prev) => {
      const cur = prev[sku];
      if (!cur) return prev;
      if (qty <= 0) {
        const { [sku]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [sku]: { ...cur, qty } };
    });
  }
  function removeFromCart(sku: string) {
    setCart((prev) => {
      const { [sku]: _, ...rest } = prev;
      return rest;
    });
  }

  const submitM = useMutation({
    mutationFn: async () => {
      const items = cartItems.filter((it) => it.qty > 0).map(({ sku, name_ar, qty }) => ({ sku, name_ar, qty }));
      if (items.length === 0) throw new Error("أضف منتجاً واحداً على الأقل");
      const items_count = items.reduce((s, it) => s + it.qty, 0);
      const { error } = await supabase.from("aqh_restock_requests").insert({
        items: items as unknown as never,
        items_count,
        request_kind: effectiveKind,
        employee_name: employeeName.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(effectiveKind === "report" ? "تم تسجيل بلاغ النفاد" : "تم تسجيل طلب التوريد");
      qc.invalidateQueries({ queryKey: ["aqh_restock_requests"] });
      setCart({});
      setNotes("");
      setKind("auto");
      setShowCart(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  const isEmpty = !productsQ.isLoading && (productsQ.data ?? []).length === 0;

  return (
    <div className="space-y-4">
      {isEmpty && isAdmin && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">الكاتالوج فارغ</div>
            <div className="text-xs text-muted-foreground">يمكنك تعبئة 662 منتجاً من بيانات السلة دفعة واحدة.</div>
          </div>
          <Button
            onClick={() => seedM.mutate()}
            disabled={seedM.isPending}
            className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30"
          >
            {seedM.isPending ? <Loader2 className="animate-spin" size={14} /> : <><Sparkles size={14} className="ml-1" /> تعبئة الكاتالوج</>}
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المنتج أو SKU…"
            className="pr-9"
          />
        </div>
        <Select value={rtype} onValueChange={(v) => setRtype(v as typeof rtype)}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="نوع التعامل" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="supplier">طلب من مورّد</SelectItem>
            <SelectItem value="inventory">جرد / بلاغ نفاد</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="كل التصنيفات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التصنيفات</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => setShowCart(true)}
          disabled={cartItems.length === 0}
          className="bg-gold/10 border-gold/30 text-gold hover:bg-gold/20 hover:text-gold"
        >
          <ShoppingCart size={14} className="ml-1" />
          السلة ({cartItems.length}) · {cartCount}
        </Button>
      </div>

      {productsQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">لا توجد منتجات مطابقة.</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">عدد المنتجات: {filtered.length}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const inCart = cart[p.sku];
              const low = p.current_qty <= 2;
              const isInv = p.restock_type === "inventory";
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-2 flex gap-2"
                >
                  <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name_ar} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Package size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-medium text-sm leading-tight line-clamp-2">{p.name_ar}</div>
                      <Badge variant="outline" className="shrink-0 text-[9px]" dir="ltr">{p.sku}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate">{p.category ?? "—"}</span>
                      <span className={low ? "text-amber-400" : ""}>المخزون: {p.current_qty}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px]">
                      {isInv ? (
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          <ClipboardList size={9} className="inline ml-0.5" /> جرد
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">
                          <Truck size={9} className="inline ml-0.5" /> توريد
                        </span>
                      )}
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-1 mt-auto">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(p.sku, inCart.qty - 1)}>
                          <Minus size={12} />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={inCart.qty}
                          onChange={(e) => setQty(p.sku, parseInt(e.target.value || "0", 10))}
                          className="h-7 text-center px-1 text-sm"
                        />
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(p.sku, inCart.qty + 1)}>
                          <Plus size={12} />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 mt-auto bg-gold/10 border-gold/30 text-gold hover:bg-gold/20 hover:text-gold"
                        onClick={() => addToCart(p)}
                      >
                        <Plus size={12} className="ml-1" /> أضف
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>{effectiveKind === "report" ? "بلاغ نفاد مخزون" : "سلة طلب التوريد"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {cartItems.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">السلة فارغة</div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((it) => (
                  <div key={it.sku} className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{it.name_ar}</div>
                      <div className="text-[10px] text-muted-foreground" dir="ltr">{it.sku} · {RTYPE_LABEL[it.restock_type]}</div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(it.sku, it.qty - 1)}>
                      <Minus size={12} />
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      value={it.qty}
                      onChange={(e) => setQty(it.sku, parseInt(e.target.value || "0", 10))}
                      className="h-7 w-16 text-center px-1 text-sm"
                    />
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(it.sku, it.qty + 1)}>
                      <Plus size={12} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeFromCart(it.sku)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">نوع الطلب</label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">تلقائي ({KIND_LABEL[autoKind]})</SelectItem>
                  <SelectItem value="order">طلب توريد</SelectItem>
                  <SelectItem value="report">بلاغ نفاد</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">اسم الموظف (اختياري)</label>
              <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="اسمك…" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ملاحظة (اختياري)</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="ملاحظة لفريق الشراء…" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCart(false)}>إغلاق</Button>
            <Button
              onClick={() => submitM.mutate()}
              disabled={submitM.isPending || cartItems.length === 0}
              className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30"
            >
              {submitM.isPending ? <Loader2 className="animate-spin" size={14} /> : "تأكيد الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- TAB 2: Requests list ---------------- */

function RequestsListTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RestockStatus | "all">("all");
  const [kindF, setKindF] = useState<RequestKind | "all">("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const requestsQ = useQuery({
    queryKey: ["aqh_restock_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_restock_requests")
        .select("id, employee_name, created_by, request_kind, status, items, items_count, notes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        items: (Array.isArray(r.items) ? r.items : []) as RestockItem[],
        status: (r.status ?? "new") as RestockStatus,
        request_kind: (r.request_kind ?? "order") as RequestKind,
      })) as RestockRequest[];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    (requestsQ.data ?? []).forEach((r) => r.created_by && s.add(r.created_by));
    return Array.from(s);
  }, [requestsQ.data]);

  const profilesQ = useQuery({
    queryKey: ["aqh_restock_profiles", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => m.set(p.id, p.full_name ?? ""));
      return m;
    },
  });

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (requestsQ.data ?? []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (kindF !== "all" && r.request_kind !== kindF) return false;
      if (!text) return true;
      const hay = `${r.employee_name ?? ""} ${r.items.map((i) => `${i.name_ar} ${i.sku}`).join(" ")}`.toLowerCase();
      return hay.includes(text);
    });
  }, [requestsQ.data, status, kindF, q]);

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

  const exportRow = (r: RestockRequest) => {
    const actor = (r.created_by && profilesQ.data?.get(r.created_by)) || r.employee_name || "";
    const headers = ["request_id", "kind", "status", "employee", "notes", "created_at", "sku", "name_ar", "qty"];
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows = r.items.map((it) => [
      String(r.id),
      KIND_LABEL[r.request_kind],
      STATUS_LABEL[r.status],
      actor,
      (r.notes ?? "").replace(/\r?\n/g, " "),
      r.created_at,
      it.sku,
      it.name_ar,
      String(it.qty),
    ].map(esc).join(","));
    const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restock-${r.id}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المنتج أو الموظف…"
            className="pr-9"
          />
        </div>
        <Select value={kindF} onValueChange={(v) => setKindF(v as RequestKind | "all")}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="order">طلب توريد</SelectItem>
            <SelectItem value="report">بلاغ نفاد</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as RestockStatus | "all")}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="new">جديد</SelectItem>
            <SelectItem value="ordered">تم الطلب</SelectItem>
            <SelectItem value="received">تم الاستلام</SelectItem>
            <SelectItem value="resolved">تمت المعالجة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الأصناف</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الموظف</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="text-left">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requestsQ.isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                <Loader2 className="inline animate-spin" size={14} /> جارٍ التحميل…
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                لا توجد طلبات.
              </TableCell></TableRow>
            ) : filtered.map((r) => {
              const actor = (r.created_by && profilesQ.data?.get(r.created_by)) || r.employee_name || "—";
              const isOpen = expanded === r.id;
              const isReport = r.request_kind === "report";
              return (
                <>
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">#{r.id}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${isReport ? "bg-sky-500/15 text-sky-300 border-sky-500/30" : "bg-gold/10 text-gold border-gold/30"}`}>
                        {isReport ? <ClipboardList size={10} /> : <Truck size={10} />}
                        {KIND_LABEL[r.request_kind]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                      >
                        {r.items.length} صنف
                        {isOpen ? <ChevronUp size={12} className="mr-1" /> : <ChevronDown size={12} className="mr-1" />}
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.items_count}</TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(v) => {
                          const next = v as RestockStatus;
                          if (next === r.status) return;
                          statusM.mutate({ id: r.id, next });
                        }}
                      >
                        <SelectTrigger
                          className={`h-7 px-2 py-0 text-[11px] rounded-md ${statusBadgeClass(r.status)} border-0 focus:ring-0 w-auto min-w-[110px]`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">جديد</SelectItem>
                          <SelectItem value="ordered">تم الطلب</SelectItem>
                          <SelectItem value="received">تم الاستلام</SelectItem>
                          <SelectItem value="resolved">تمت المعالجة</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{actor}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                      {new Date(r.created_at).toLocaleString("ar-SA")}
                    </TableCell>
                    <TableCell className="text-left">
                      <Button size="sm" variant="outline" onClick={() => exportRow(r)} title="تصدير CSV">
                        <Download size={13} className="ml-1" /> CSV
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={`${r.id}-items`}>
                      <TableCell colSpan={8} className="bg-white/[0.02]">
                        <div className="space-y-1 py-2">
                          {r.items.map((it, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex-1 truncate">
                                <span className="font-medium">{it.name_ar}</span>
                                <span className="text-muted-foreground ml-2" dir="ltr"> · {it.sku}</span>
                              </div>
                              <div className="shrink-0 text-gold">× {it.qty}</div>
                            </div>
                          ))}
                          {r.notes && (
                            <div className="text-xs text-muted-foreground border-t border-white/10 pt-2 mt-2">
                              <span className="text-foreground">ملاحظة: </span>{r.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
