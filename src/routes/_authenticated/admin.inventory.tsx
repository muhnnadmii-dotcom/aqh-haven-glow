import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { toast } from "sonner";
import { Package, Search, Plus, Download, Loader2 } from "lucide-react";
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
  id: string;
  sku: string | null;
  name_ar: string;
  name_en: string | null;
  category: string | null;
  unit: string | null;
  is_active: boolean;
};

type RestockStatus = "new" | "ordered" | "received";

type RestockRequest = {
  id: string;
  product_id: string;
  qty: number;
  status: RestockStatus;
  requested_by: string | null;
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
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
  const [picking, setPicking] = useState<Product | null>(null);
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");

  const productsQ = useQuery({
    queryKey: ["aqh_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products" as never)
        .select("id, sku, name_ar, name_en, category, unit, is_active")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name_ar", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    (productsQ.data ?? []).forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [productsQ.data]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (productsQ.data ?? []).filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!text) return true;
      return (
        p.name_ar.toLowerCase().includes(text) ||
        (p.name_en ?? "").toLowerCase().includes(text) ||
        (p.sku ?? "").toLowerCase().includes(text)
      );
    });
  }, [productsQ.data, q, category]);

  const submitM = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مصادق");
      if (!picking) throw new Error("لم يتم اختيار منتج");
      const n = parseFloat(qty);
      if (!Number.isFinite(n) || n <= 0) throw new Error("أدخل كمية صحيحة");
      const { error } = await supabase.from("aqh_restock_requests" as never).insert({
        product_id: picking.id,
        qty: n,
        notes: notes.trim() || null,
        requested_by: u.user.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل طلب التوريد");
      qc.invalidateQueries({ queryKey: ["aqh_restock_requests"] });
      setPicking(null);
      setQty("1");
      setNotes("");
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
      </div>

      {productsQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">لا توجد منتجات مطابقة.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name_ar}</div>
                  {p.name_en && (
                    <div className="text-[11px] text-muted-foreground truncate" dir="ltr">{p.name_en}</div>
                  )}
                </div>
                {p.sku && (
                  <Badge variant="outline" className="shrink-0 text-[10px]" dir="ltr">{p.sku}</Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{p.category ?? "—"}</span>
                <span>{p.unit ?? ""}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="bg-gold/10 border-gold/30 text-gold hover:bg-gold/20 hover:text-gold"
                onClick={() => { setPicking(p); setQty("1"); setNotes(""); }}
              >
                <Plus size={14} className="ml-1" /> اطلب توريد
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!picking} onOpenChange={(o) => !o && setPicking(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>طلب توريد — {picking?.name_ar}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">الكمية {picking?.unit ? `(${picking.unit})` : ""}</label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ملاحظة (اختياري)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="ملاحظة للموردين أو فريق الشراء…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPicking(null)}>إلغاء</Button>
            <Button
              onClick={() => submitM.mutate()}
              disabled={submitM.isPending}
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

  const productsQ = useQuery({
    queryKey: ["aqh_products_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products" as never)
        .select("id, sku, name_ar, name_en, category, unit, is_active");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const requestsQ = useQuery({
    queryKey: ["aqh_restock_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_restock_requests" as never)
        .select("id, product_id, qty, status, requested_by, notes, ordered_at, received_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RestockRequest[];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    (requestsQ.data ?? []).forEach((r) => r.requested_by && s.add(r.requested_by));
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

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    (productsQ.data ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [productsQ.data]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (requestsQ.data ?? []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!text) return true;
      const p = productMap.get(r.product_id);
      const hay = `${p?.name_ar ?? ""} ${p?.name_en ?? ""} ${p?.sku ?? ""}`.toLowerCase();
      return hay.includes(text);
    });
  }, [requestsQ.data, status, q, productMap]);

  const statusM = useMutation({
    mutationFn: async (args: { id: string; next: RestockStatus }) => {
      const patch: Record<string, unknown> = { status: args.next };
      if (args.next === "ordered") patch.ordered_at = new Date().toISOString();
      if (args.next === "received") patch.received_at = new Date().toISOString();
      const { error } = await supabase
        .from("aqh_restock_requests" as never)
        .update(patch as never)
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
    const p = productMap.get(r.product_id);
    const actor = (r.requested_by && profilesQ.data?.get(r.requested_by)) || "";
    const headers = ["id","sku","product_ar","product_en","category","unit","qty","status","requested_by","notes","ordered_at","received_at","created_at"];
    const row = [
      r.id, p?.sku ?? "", p?.name_ar ?? "", p?.name_en ?? "", p?.category ?? "",
      p?.unit ?? "", String(r.qty), STATUS_LABEL[r.status], actor,
      (r.notes ?? "").replace(/\r?\n/g, " "),
      r.ordered_at ?? "", r.received_at ?? "", r.created_at,
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + headers.join(",") + "\n" + row.map(esc).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restock-${(p?.sku ?? r.id).toString()}-${r.id.slice(0,8)}.csv`;
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
            placeholder="ابحث باسم المنتج…"
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
              <TableHead>المنتج</TableHead>
              <TableHead>الكمية</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>طالب التوريد</TableHead>
              <TableHead>تاريخ الطلب</TableHead>
              <TableHead className="text-left">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requestsQ.isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                <Loader2 className="inline animate-spin" size={14} /> جارٍ التحميل…
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                لا توجد طلبات.
              </TableCell></TableRow>
            ) : filtered.map((r) => {
              const p = productMap.get(r.product_id);
              const actor = (r.requested_by && profilesQ.data?.get(r.requested_by)) || "—";
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p?.name_ar ?? "—"}</div>
                      {p?.sku && <div className="text-[11px] text-muted-foreground" dir="ltr">{p.sku}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.qty} {p?.unit ?? ""}</TableCell>
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
                        <SelectItem value="ordered" disabled={r.status === "received"}>تم الطلب</SelectItem>
                        <SelectItem value="received" disabled={r.status === "new"}>تم الاستلام</SelectItem>
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
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
