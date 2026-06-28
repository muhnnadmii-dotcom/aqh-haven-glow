import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SALLA_COLUMNS } from "@/lib/aqh-salla-columns";

export const Route = createFileRoute("/_authenticated/admin/inventory/export")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "staff"]).limit(1).maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
  },
  component: ExportPage,
});

type Row = {
  sku: string;
  name_ar: string;
  category: string | null;
  current_qty: number | null;
  cost: number | null;
  price: number | null;
  image_url: string | null;
  salla_raw: Record<string, any> | null;
};

async function loadAllProducts(): Promise<Row[]> {
  const pageSize = 1000;
  const all: Row[] = [];
  let from = 0;
  // paginate to be safe
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("aqh_products" as any)
      .select("sku,name_ar,category,current_qty,cost,price,image_url,salla_raw")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data as unknown as Row[]) ?? [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function rowsToAOA(products: Row[]): any[][] {
  const header = [...SALLA_COLUMNS];
  const out: any[][] = [header];
  for (const p of products) {
    const raw = p.salla_raw ?? {};
    // Override with current edited core columns
    const override: Record<string, any> = {
      "أسم المنتج": p.name_ar,
      "تصنيف المنتج": p.category ?? raw["تصنيف المنتج"] ?? "",
      "صورة المنتج": p.image_url ?? raw["صورة المنتج"] ?? "",
      "الكمية المتوفرة": p.current_qty != null ? String(p.current_qty) : (raw["الكمية المتوفرة"] ?? ""),
      "سعر التكلفة": p.cost != null ? String(p.cost) : (raw["سعر التكلفة"] ?? ""),
      "سعر المنتج": p.price != null ? String(p.price) : (raw["سعر المنتج"] ?? ""),
      "رمز المنتج sku": p.sku,
    };
    const row = header.map((k) => {
      const v = k in override ? override[k] : raw[k];
      if (v == null) return "";
      return typeof v === "object" ? JSON.stringify(v) : v;
    });
    out.push(row);
  }
  return out;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ExportPage() {
  const [busy, setBusy] = useState<"xlsx" | "csv" | null>(null);
  const [count, setCount] = useState<number | null>(null);

  async function exportXlsx() {
    setBusy("xlsx");
    try {
      const products = await loadAllProducts();
      setCount(products.length);
      const aoa = rowsToAOA(products);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      (ws as any)["!cols"] = SALLA_COLUMNS.map(() => ({ wch: 20 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      XLSX.writeFile(wb, `salla_export_${todayStr()}.xlsx`);
      toast.success(`تم تصدير ${products.length} منتج`);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التصدير");
    } finally {
      setBusy(null);
    }
  }

  async function exportCsv() {
    setBusy("csv");
    try {
      const products = await loadAllProducts();
      setCount(products.length);
      const aoa = rowsToAOA(products);
      const esc = (v: any) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const content = "\uFEFF" + aoa.map((r) => r.map(esc).join(",")).join("\n");
      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salla_export_${todayStr()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`تم تصدير ${products.length} منتج`);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التصدير");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-semibold">تصدير ملف سلة</h1>
        <p className="text-sm text-muted-foreground mt-1">
          يُنتج ملفاً بصيغة سلة الأصلية بنفس الأعمدة الـ 71 وترتيبها — قابل لإعادة الرفع مباشرة. القيم المعدّلة في المنتجات (الاسم، السعر، الكمية…) تظهر في الملف.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-center gap-3 text-gold">
          <FileSpreadsheet />
          <div>
            <div className="text-sm font-semibold">ملف Salla — كل المنتجات</div>
            <div className="text-[11px] text-muted-foreground">71 عمود · ترتيب أصلي · UTF-8</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={exportXlsx} disabled={!!busy} className="bg-gold text-black hover:bg-gold/90">
            {busy === "xlsx" ? <Loader2 size={14} className="animate-spin ms-1" /> : <Download size={14} className="ms-1" />}
            تصدير ملف سلة (.xlsx)
          </Button>
          <Button onClick={exportCsv} disabled={!!busy} variant="outline">
            {busy === "csv" ? <Loader2 size={14} className="animate-spin ms-1" /> : <Download size={14} className="ms-1" />}
            تصدير CSV
          </Button>
        </div>

        {count != null && (
          <div className="text-[11px] text-muted-foreground">آخر تصدير: {count} منتج</div>
        )}
      </div>
    </div>
  );
}
