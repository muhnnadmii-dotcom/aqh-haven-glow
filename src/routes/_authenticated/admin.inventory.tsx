import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { toast } from "sonner";
import {
  Package, Search, Plus, Minus, Trash2, Download, Loader2, ShoppingCart, ChevronDown, ChevronUp,
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
  },
  component: InventoryPage,
});

type Product = {
  id: number;
  sku: string;
  name_ar: string;
  category: string | null;
  image_url: string | null;
  current_qty: number;
  cost: number;
  is_active: boolean;
};

type RestockStatus = "new" | "ordered" | "received";

type RestockItem = { sku: string; name_ar: string; qty: number };

type RestockRequest = {
  id: number;
  employee_name: string | null;
  created_by: string | null;
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
};

function statusBadgeClass(s: RestockStatus): string {
  if (s === "new") return "bg-white/10 text-foreground border border-white/15";
  if (s === "ordered") return "bg-gold/15 text-gold border border-gold/30";
  return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
}

function InventoryPage() {
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <Package size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">المخزون وإعادة التوريد</h1>
          <p className="text-xs text-muted-foreground">إدارة طلبات توريد منتجات الأحواض</p>
        </div>
      </header>

      <Tabs defaultValue="request" dir="rtl">
        <TabsList>
          <TabsTrigger value="request">طلب توريد</TabsTrigger>
          <TabsTrigger value="list">الطلبات</TabsTrigger>
        </TabsList>
        <TabsContent value="request" className="mt-4">
          <RequestTab />
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          <RequestsListTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- TAB 1: Request restock ---------------- */

function RequestTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [cart, setCart] = useState<Record<string, RestockItem>>({});
  const [employeeName, setEmployeeName] = useState("");
  const [notes, setNotes] = useState("");
  const [showCart, setShowCart] = useState(false);

  const productsQ = useQuery({
    queryKey: ["aqh_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products")
        .select("id, sku, name_ar, category, image_url, current_qty, cost, is_active")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name_ar", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
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
      if (!text) return true;
      return (
        p.name_ar.toLowerCase().includes(text) ||
        p.sku.toLowerCase().includes(text)
      );
    });
  }, [productsQ.data, q, category]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartCount = cartItems.reduce((s, it) => s + (it.qty || 0), 0);

  function addToCart(p: Product) {
    setCart((prev) => {
      const cur = prev[p.sku];
      return { ...prev, [p.sku]: { sku: p.sku, name_ar: p.name_ar, qty: (cur?.qty ?? 0) + 1 } };
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
      const items = cartItems.filter((it) => it.qty > 0);
      if (items.length === 0) throw new Error("أضف منتجاً واحداً على الأقل");
      const items_count = items.reduce((s, it) => s + it.qty, 0);
      const { error } = await supabase.from("aqh_restock_requests").insert({
        items: items as unknown as never,
        items_count,
        employee_name: employeeName.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل طلب التوريد");
      qc.invalidateQueries({ queryKey: ["aqh_restock_requests"] });
      setCart({});
      setNotes("");
      setShowCart(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  return (
    <div className="space-y-4">
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
          <DialogHeader><DialogTitle>سلة طلب التوريد</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {cartItems.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">السلة فارغة</div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((it) => (
                  <div key={it.sku} className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{it.name_ar}</div>
                      <div className="text-[10px] text-muted-foreground" dir="ltr">{it.sku}</div>
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
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const requestsQ = useQuery({
    queryKey: ["aqh_restock_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_restock_requests")
        .select("id, employee_name, created_by, status, items, items_count, notes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        items: (Array.isArray(r.items) ? r.items : []) as RestockItem[],
        status: r.status as RestockStatus,
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
      if (!text) return true;
      const hay = `${r.employee_name ?? ""} ${r.items.map((i) => `${i.name_ar} ${i.sku}`).join(" ")}`.toLowerCase();
      return hay.includes(text);
    });
  }, [requestsQ.data, status, q]);

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
    const headers = ["request_id", "status", "employee", "notes", "created_at", "sku", "name_ar", "qty"];
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows = r.items.map((it) => [
      String(r.id),
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
        <Select value={status} onValueChange={(v) => setStatus(v as RestockStatus | "all")}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="new">جديد</SelectItem>
            <SelectItem value="ordered">تم الطلب</SelectItem>
            <SelectItem value="received">تم الاستلام</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
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
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                <Loader2 className="inline animate-spin" size={14} /> جارٍ التحميل…
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                لا توجد طلبات.
              </TableCell></TableRow>
            ) : filtered.map((r) => {
              const actor = (r.created_by && profilesQ.data?.get(r.created_by)) || r.employee_name || "—";
              const isOpen = expanded === r.id;
              return (
                <>
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">#{r.id}</TableCell>
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
                      <TableCell colSpan={7} className="bg-white/[0.02]">
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
