import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/finance/chart-of-accounts")({
  ssr: false,
  component: ChartOfAccountsPage,
});

const TYPE_LABEL: Record<string, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

function ChartOfAccountsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code: "", name_ar: "", name_en: "", account_type: "asset", account_subtype: "" });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["coa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chart_of_accounts").insert({
        ...form,
        name_en: form.name_en || null,
        account_subtype: form.account_subtype || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إنشاء الحساب");
      qc.invalidateQueries({ queryKey: ["coa"] });
      setShowNew(false);
      setForm({ code: "", name_ar: "", name_en: "", account_type: "asset", account_subtype: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("chart_of_accounts").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coa"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return (accounts || []).filter((a: any) => {
      if (filterType && a.account_type !== filterType) return false;
      if (q && !`${a.code} ${a.name_ar} ${a.name_en || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [accounts, q, filterType]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">دليل الحسابات</h2>
        <Button size="sm" onClick={() => setShowNew(!showNew)}><Plus size={14} className="ml-1" /> حساب جديد</Button>
      </div>

      {showNew && (
        <div className="border border-white/10 rounded-xl p-4 bg-white/5 space-y-3">
          <div className="grid md:grid-cols-3 gap-2">
            <Input placeholder="الكود" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Input placeholder="الاسم عربي" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            <Input placeholder="الاسم إنجليزي (اختياري)" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            <select className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-sm" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Input placeholder="نوع فرعي" value={form.account_subtype} onChange={(e) => setForm({ ...form, account_subtype: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>إلغاء</Button>
            <Button size="sm" disabled={!form.code || !form.name_ar || create.isPending} onClick={() => create.mutate()}>حفظ</Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select className="bg-white/5 border border-white/10 rounded-md px-2 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto"><table className="min-w-full text-sm">
            <thead className="bg-white/5 text-xs">
              <tr>
                <th className="p-2 text-right">الكود</th>
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-right">النوع</th>
                <th className="p-2 text-right">النوع الفرعي</th>
                <th className="p-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a: any) => (
                <tr key={a.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="p-2 font-mono">{a.code}</td>
                  <td className="p-2">{a.name_ar} {a.is_system && <Lock size={11} className="inline text-gold ml-1" />}</td>
                  <td className="p-2"><Badge variant="outline">{TYPE_LABEL[a.account_type]}</Badge></td>
                  <td className="p-2 text-muted-foreground">{a.account_subtype}</td>
                  <td className="p-2">
                    <button
                      onClick={() => toggle.mutate({ id: a.id, is_active: !a.is_active })}
                      className={`text-xs px-2 py-0.5 rounded ${a.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}
                    >
                      {a.is_active ? "نشط" : "متوقف"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
