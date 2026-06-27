import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Trash2, Save, Printer, Loader2, Search, FileText, Sparkles, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { AQH_PAYMENT_TERMS, AQH_DELIVERY_TERMS, AQH_WARRANTY_TERMS, AQH_NOTES_TEMPLATES } from "@/lib/aqh-quote-templates";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/admin/finance/quotes/$id")({
  ssr: false,
  component: QuoteBuilder,
});

type LineItem = {
  uid: string;
  name: string;
  description: string;
  unit: string;
  qty: number;
  price: number;
  taxable: boolean;
  ref?: string | null;
  source?: "salla" | "supplier" | "manual" | null;
};

type Catalog = {
  source: "salla" | "supplier";
  ref: string | null;
  name: string;
  category: string | null;
  supplier_name: string | null;
  cost: number | null;
  supplier_cost: number | null;
};

const FMT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SAR = (n: number) => FMT.format(Number.isFinite(n) ? n : 0);
const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_TERMS = {
  payment: "50% دفعة مقدمة عند الموافقة، 50% قبل التسليم.",
  delivery: "مدة التنفيذ من 2 إلى 4 أسابيع من تاريخ الدفعة المقدمة.",
  warranty: "ضمان سنة على التركيب والمعدات الرئيسية، ولا يشمل الكائنات الحية.",
  scope: "تصميم وتنفيذ حوض أسماك متكامل شامل التركيب والتشغيل الأولي.",
};

function QuoteBuilder() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ---- Quote form state
  const [companyName, setCompanyName] = useState("Aqua Haven");
  const [companySub, setCompanySub] = useState("تصميم وتنفيذ الأحواض الفاخرة");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [quoteNo, setQuoteNo] = useState<string>("");
  const [quoteDate, setQuoteDate] = useState<string>(todayISO());
  const [validUntil, setValidUntil] = useState<string>(plusDaysISO(15));
  const [salesperson, setSalesperson] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectCity, setProjectCity] = useState("");
  const [scopeText, setScopeText] = useState(DEFAULT_TERMS.scope);
  const [notesText, setNotesText] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_TERMS.payment);
  const [deliveryTerms, setDeliveryTerms] = useState(DEFAULT_TERMS.delivery);
  const [warrantyTerms, setWarrantyTerms] = useState(DEFAULT_TERMS.warranty);
  const [vatRate, setVatRate] = useState(15);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [currency, setCurrency] = useState("SAR");
  const pricesIncludeVat = false; // fixed: prices are entered without VAT
  const [status, setStatus] = useState<"draft" | "sent" | "accepted" | "rejected">("draft");
  const [items, setItems] = useState<LineItem[]>([
    { uid: uid(), name: "", description: "", unit: "قطعة", qty: 1, price: 0, taxable: true, source: "manual" },
  ]);
  const [footerPhone, setFooterPhone] = useState("0552700442");
  const [footerEmail, setFooterEmail] = useState("info@aquahaven.sa");
  const [footerVat, setFooterVat] = useState("الرقم الضريبي: 312327536500003");

  // Load business settings (singleton)
  const settingsQ = useQuery({
    queryKey: ["aqh_business_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_business_settings" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Apply settings defaults (only for new quotes, before user edits)
  useEffect(() => {
    const s = settingsQ.data;
    if (!s) return;
    if (s.company_name) setCompanyName(s.company_name);
    if (s.company_sub) setCompanySub(s.company_sub);
    if (s.logo_url) setLogoUrl(s.logo_url);
    if (s.phone) setFooterPhone(s.phone);
    if (s.email) setFooterEmail(s.email);
    if (s.vat_number) setFooterVat(`الرقم الضريبي: ${s.vat_number}`);
    if (isNew && s.default_vat_rate != null) setVatRate(Number(s.default_vat_rate));
  }, [settingsQ.data, isNew]);

  // Load existing quote
  const loadQ = useQuery({
    queryKey: ["aqh_quote", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("aqh_quotes").select("*").eq("id", Number(id)).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!loadQ.data) return;
    const d: any = loadQ.data;
    setQuoteNo(d.quote_no ?? "");
    setClientName(d.client_name ?? "");
    setClientContact(d.client_contact ?? "");
    setProjectName(d.project_name ?? "");
    setProjectCity(d.project_city ?? "");
    setScopeText(d.scope_text ?? "");
    setNotesText(d.notes_text ?? "");
    setPaymentTerms(d.payment_terms ?? "");
    setDeliveryTerms(d.delivery_terms ?? "");
    setWarrantyTerms(d.warranty_terms ?? "");
    setVatRate(Number(d.vat_rate ?? 15));
    setDiscount(Number(d.discount ?? 0));
    setDiscountType((d.discount_type as any) ?? "amount");
    setCurrency(d.currency ?? "SAR");
    // pricesIncludeVat is fixed to false; ignore legacy field
    setStatus((d.status as any) ?? "draft");
    if (Array.isArray(d.items)) {
      setItems(d.items.map((it: any) => ({ uid: uid(), ...it })));
    }
  }, [loadQ.data]);

  // ---- Calculations (prices always entered WITHOUT VAT)
  const calc = useMemo(() => {
    const lineTotals = items.map((it) => (Number(it.qty) || 0) * (Number(it.price) || 0));
    const totalsByTax = items.reduce(
      (acc, it, i) => {
        const lt = lineTotals[i];
        if (it.taxable) acc.taxable += lt;
        else acc.nonTaxable += lt;
        return acc;
      },
      { taxable: 0, nonTaxable: 0 }
    );

    const grossAll = totalsByTax.taxable + totalsByTax.nonTaxable;
    const discountValue =
      discountType === "percent" ? grossAll * (Number(discount) || 0) / 100 : Number(discount) || 0;
    const ratio = grossAll > 0 ? Math.max(0, 1 - discountValue / grossAll) : 1;
    const vr = (Number(vatRate) || 0) / 100;

    // Per-line VAT/total (after discount ratio applied), exclusive VAT model
    const lineVat = items.map((it, i) => (it.taxable ? lineTotals[i] * ratio * vr : 0));
    const lineWithVat = items.map((i, idx) => lineTotals[idx] * ratio + lineVat[idx]);

    const taxableAfter = totalsByTax.taxable * ratio;
    const nonTaxAfter = totalsByTax.nonTaxable * ratio;
    const vatTotal = taxableAfter * vr;
    const subtotalBeforeVat = taxableAfter + nonTaxAfter;
    const grandTotal = subtotalBeforeVat + vatTotal;

    return {
      lineTotals,
      lineVat,
      lineWithVat,
      gross: grossAll,
      discountValue,
      subtotalBeforeVat: +subtotalBeforeVat.toFixed(2),
      vatTotal: +vatTotal.toFixed(2),
      grandTotal: +grandTotal.toFixed(2),
    };
  }, [items, vatRate, discount, discountType]);

  // ---- Product search
  const [searchOpenFor, setSearchOpenFor] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const searchQ = useQuery({
    queryKey: ["aqh_quote_products_search", searchText],
    enabled: !!searchOpenFor && searchText.trim().length >= 1,
    queryFn: async () => {
      const t = `%${searchText.trim()}%`;
      const { data, error } = await supabase
        .from("aqh_quote_products" as any)
        .select("source,ref,name,category,supplier_name,cost,supplier_cost")
        .or(`name.ilike.${t},ref.ilike.${t},supplier_name.ilike.${t}`)
        .limit(20);
      if (error) throw error;
      return (data as unknown as Catalog[]) ?? [];
    },
  });

  function patchItem(uidVal: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.uid === uidVal ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((p) => [...p, { uid: uid(), name: "", description: "", unit: "قطعة", qty: 1, price: 0, taxable: true, source: "manual" }]);
  }
  function delItem(u: string) { setItems((p) => p.filter((it) => it.uid !== u)); }
  function addSampleTank() {
    setItems((p) => [
      ...p,
      { uid: uid(), name: "حوض مخصص 120×50×50 سم", description: "زجاج فائق الشفافية 12مم، خلفية سوداء", unit: "حوض", qty: 1, price: 4500, taxable: true, source: "manual" },
      { uid: uid(), name: "كابينة خشبية مطابقة", description: "MDF مقاوم للماء، تشطيب لاكر", unit: "كابينة", qty: 1, price: 2200, taxable: true, source: "manual" },
      { uid: uid(), name: "فلتر خارجي + إضاءة LED", description: "نظام تصفية وإضاءة احترافي", unit: "طقم", qty: 1, price: 1800, taxable: true, source: "manual" },
      { uid: uid(), name: "تركيب وتشغيل أولي", description: "زيارة فنية + ضبط معايير الماء", unit: "خدمة", qty: 1, price: 800, taxable: true, source: "manual" },
    ]);
  }

  function pickProduct(itemUid: string, p: Catalog) {
    const price = p.source === "salla" ? Number(p.cost) || 0 : Number(p.supplier_cost) || 0;
    patchItem(itemUid, {
      name: p.name,
      price,
      ref: p.ref,
      source: p.source,
      description: p.source === "supplier" ? `${p.supplier_name ?? ""}` : (p.category ?? ""),
    });
    setSearchOpenFor(null);
    setSearchText("");
  }

  function onLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogoUrl(String(r.result || ""));
    r.readAsDataURL(f);
  }

  // ---- Save
  const saveM = useMutation({
    mutationFn: async () => {
      let qn = quoteNo;
      if (!qn) {
        const { data: nx, error: ee } = await supabase.rpc("aqh_next_quote_no" as any);
        if (ee) throw ee;
        qn = String(nx);
      }
      const payload = {
        quote_no: qn,
        client_name: clientName || null,
        client_contact: clientContact || null,
        project_name: projectName || null,
        project_city: projectCity || null,
        status,
        currency,
        vat_rate: vatRate,
        discount,
        discount_type: discountType,
        prices_include_vat: pricesIncludeVat,
        items: items.map(({ uid: _u, ...rest }) => rest) as unknown as never,
        scope_text: scopeText || null,
        notes_text: notesText || null,
        payment_terms: paymentTerms || null,
        delivery_terms: deliveryTerms || null,
        warranty_terms: warrantyTerms || null,
        subtotal: calc.subtotalBeforeVat,
        vat_total: calc.vatTotal,
        grand_total: calc.grandTotal,
      };
      if (isNew) {
        const { data, error } = await supabase.from("aqh_quotes").insert(payload as any).select("id,quote_no").single();
        if (error) throw error;
        return { id: data.id as number, quote_no: data.quote_no as string };
      } else {
        const { error } = await supabase.from("aqh_quotes").update(payload as any).eq("id", Number(id));
        if (error) throw error;
        return { id: Number(id), quote_no: qn };
      }
    },
    onSuccess: (r) => {
      toast.success(`تم الحفظ — ${r.quote_no}`);
      setQuoteNo(r.quote_no);
      qc.invalidateQueries({ queryKey: ["aqh_quotes_list"] });
      if (isNew) navigate({ to: "/admin/finance/quotes/$id", params: { id: String(r.id) }, replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  const printRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Toolbar (hidden in print) */}
      <div className="no-print flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/admin/finance/quotes" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center" aria-label="رجوع">
            <ArrowRight size={16} />
          </Link>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText size={18} className="text-gold" />
              {isNew ? "عرض سعر جديد" : `عرض ${quoteNo || "(غير محفوظ)"}`}
            </h2>
            <p className="text-[11px] text-muted-foreground">أنشئ بنود العرض من البحث في المنتجات أو يدويًا</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="sent">مُرسل</SelectItem>
              <SelectItem value="accepted">مقبول</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()} className="gap-1">
            <Printer size={14} /> طباعة / PDF
          </Button>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 gap-1">
            {saveM.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} حفظ
          </Button>
        </div>
      </div>

      {/* Settings panel (hidden in print) */}
      <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">نسبة الضريبة %</label>
          <Input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">الخصم</label>
          <div className="flex gap-1">
            <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amount">ر.س</SelectItem>
                <SelectItem value="percent">%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">العملة</label>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <div className="flex items-end text-[11px] text-muted-foreground leading-snug">
          الأسعار المُدخلة <strong className="text-foreground">بدون</strong> ضريبة؛ تُحتسب الضريبة تلقائيًا 15%.
        </div>
      </div>

      {/* PRINTABLE DOCUMENT */}
      <div ref={printRef} className="quote-doc rounded-xl border border-white/10 bg-white text-slate-800 shadow-2xl p-8 md:p-12 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-amber-500 pb-6">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-20 h-20 object-contain rounded-lg border border-slate-200" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-slate-900 to-blue-900 text-amber-400 flex items-center justify-center text-2xl font-bold">AQH</div>
            )}
            <div>
              <input className="text-2xl font-bold bg-transparent outline-none w-full no-print-border" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <input className="text-sm text-slate-500 bg-transparent outline-none w-full no-print-border" value={companySub} onChange={(e) => setCompanySub(e.target.value)} />
              <label className="no-print inline-flex items-center gap-1 mt-1 text-[11px] text-slate-500 cursor-pointer hover:text-slate-700">
                <input type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
                تغيير الشعار
              </label>
            </div>
          </div>
          <div className="text-end space-y-1 quote-header-meta">
            <div className="text-[11px] uppercase tracking-widest text-amber-600 font-semibold quote-eyebrow">عرض سعر · QUOTATION</div>
            <input
              dir="ltr"
              value={quoteNo}
              onChange={(e) => setQuoteNo(e.target.value)}
              placeholder="AQH-XXXX-XXX"
              className="quote-no text-2xl font-bold font-mono bg-transparent outline-none no-print-border text-end w-48"
            />
            <div className="text-xs text-slate-500 space-y-0.5 mt-2">
              <div className="flex items-center gap-2 justify-end">
                <span>التاريخ:</span>
                <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="quote-date bg-transparent outline-none no-print-border" />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span>صالح حتى:</span>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="quote-date bg-transparent outline-none no-print-border" />
              </div>

              <div className="flex items-center gap-2 justify-end">
                <span>المسؤول:</span>
                <input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} placeholder="اسم المندوب" className="bg-transparent outline-none no-print-border w-32 text-end" />
              </div>
            </div>
          </div>
        </div>

        {/* Client & project */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">العميل</div>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="اسم العميل" className="block w-full text-base font-semibold bg-transparent outline-none no-print-border" />
            <input value={clientContact} onChange={(e) => setClientContact(e.target.value)} placeholder="جوال / بريد" className="block w-full text-sm text-slate-600 bg-transparent outline-none no-print-border mt-1" />
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">المشروع</div>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="اسم المشروع" className="block w-full text-base font-semibold bg-transparent outline-none no-print-border" />
            <input value={projectCity} onChange={(e) => setProjectCity(e.target.value)} placeholder="المدينة / الموقع" className="block w-full text-sm text-slate-600 bg-transparent outline-none no-print-border mt-1" />
          </div>
        </div>

        {/* Scope */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-amber-600 font-semibold mb-2">نطاق العمل</div>
          <Textarea value={scopeText} onChange={(e) => setScopeText(e.target.value)} className="bg-slate-50 border-slate-200 text-slate-700 no-print-border" rows={2} />
        </div>

        {/* Items table */}
        <div>
          <div className="flex items-center justify-between mb-2 no-print">
            <div className="text-[11px] uppercase tracking-widest text-amber-600 font-semibold">البنود</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addSampleTank} className="gap-1 text-xs h-8">
                <Sparkles size={12} /> نموذج حوض جاهز
              </Button>
              <Button size="sm" onClick={addItem} className="gap-1 text-xs h-8 bg-amber-500 hover:bg-amber-600 text-white">
                <Plus size={12} /> إضافة بند
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-900 text-amber-300">
                <tr>
                  <th className="px-2 py-2 text-start w-8">#</th>
                  <th className="px-2 py-2 text-start">البند / الوصف</th>
                  <th className="px-2 py-2 text-start w-20">الوحدة</th>
                  <th className="px-2 py-2 text-start w-16">الكمية</th>
                  <th className="px-2 py-2 text-start w-32">السعر (بدون ضريبة)</th>
                  <th className="px-2 py-2 text-start w-24">ضريبة 15%</th>
                  <th className="px-2 py-2 text-start w-28">الإجمالي شامل</th>
                  <th className="px-2 py-2 w-10 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.uid} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="relative">
                        <div className="flex items-center gap-1">
                          <input
                            value={it.name}
                            onChange={(e) => patchItem(it.uid, { name: e.target.value })}
                            placeholder="اسم البند"
                            className="flex-1 bg-transparent outline-none font-medium no-print-border"
                          />
                          <button
                            type="button"
                            onClick={() => { setSearchOpenFor(it.uid); setSearchText(""); }}
                            className="no-print text-[10px] px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 inline-flex items-center gap-1"
                          >
                            <Search size={10} /> بحث
                          </button>
                          {it.source && it.source !== "manual" && (
                            <span className={`no-print text-[9px] px-1.5 py-0.5 rounded border ${it.source === "salla" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                              {it.source === "salla" ? "سلة" : "مورّد"}
                            </span>
                          )}
                        </div>
                        <input
                          value={it.description}
                          onChange={(e) => patchItem(it.uid, { description: e.target.value })}
                          placeholder="وصف اختياري"
                          className="block w-full text-[11px] text-slate-500 bg-transparent outline-none mt-0.5 no-print-border"
                        />
                        {searchOpenFor === it.uid && (
                          <div className="no-print absolute z-50 top-full mt-1 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-2xl p-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Search size={12} className="text-slate-400" />
                              <input
                                autoFocus
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="ابحث بالاسم أو رقم المنتج أو اسم المورّد…"
                                className="flex-1 outline-none text-xs bg-transparent text-slate-800"
                              />
                              <button onClick={() => setSearchOpenFor(null)} className="text-[10px] text-slate-400 hover:text-slate-600">إغلاق</button>
                            </div>
                            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                              {searchText.trim().length < 1 ? (
                                <div className="text-[11px] text-slate-400 py-2 text-center">اكتب للبحث…</div>
                              ) : searchQ.isLoading ? (
                                <div className="text-[11px] text-slate-400 py-2 text-center">
                                  <Loader2 className="inline animate-spin" size={11} /> جارٍ البحث…
                                </div>
                              ) : (searchQ.data ?? []).length === 0 ? (
                                <div className="text-[11px] text-slate-400 py-2 text-center">لا توجد نتائج</div>
                              ) : (
                                (searchQ.data ?? []).map((p, idx) => {
                                  const price = p.source === "salla" ? p.cost : p.supplier_cost;
                                  return (
                                    <button
                                      key={`${p.source}-${p.ref}-${idx}`}
                                      onClick={() => pickProduct(it.uid, p)}
                                      className="w-full text-start py-1.5 px-1 hover:bg-slate-50 rounded"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="flex-1 text-xs font-medium text-slate-800 truncate">{p.name}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${p.source === "salla" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                                          {p.source === "salla" ? "سلة" : (p.supplier_name ?? "مورّد")}
                                        </span>
                                        <span className="text-[11px] font-mono text-amber-700">{price != null ? `${SAR(Number(price))} ر.س` : "—"}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{p.ref ?? ""}</div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input value={it.unit} onChange={(e) => patchItem(it.uid, { unit: e.target.value })} className="w-full bg-transparent outline-none no-print-border" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" value={it.qty} onChange={(e) => patchItem(it.uid, { qty: Number(e.target.value) })} className="w-full bg-transparent outline-none no-print-border" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="0.01" value={it.price} onChange={(e) => patchItem(it.uid, { price: Number(e.target.value) })} className="w-full bg-transparent outline-none font-mono no-print-border" />
                      {it.taxable && (Number(it.price) || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">شامل: {SAR((Number(it.price) || 0) * 1.15)} ر.س</div>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-700">
                      <div className="flex items-center gap-1">
                        <input type="checkbox" checked={it.taxable} onChange={(e) => patchItem(it.uid, { taxable: e.target.checked })} className="no-print" />
                        <span>{it.taxable ? SAR(calc.lineVat[i]) : <span className="text-[10px] text-slate-400">غير خاضعة</span>}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-700">{SAR(calc.lineWithVat[i])}</td>
                    <td className="px-2 py-2 no-print">
                      <button onClick={() => delItem(it.uid)} className="text-red-500 hover:text-red-700"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full md:w-80 space-y-1 text-sm">
            <div className="flex justify-between py-1 text-slate-600"><span>المجموع قبل الضريبة</span><span className="font-mono">{SAR(calc.subtotalBeforeVat)}</span></div>
            {calc.discountValue > 0 && (
              <div className="flex justify-between py-1 text-red-600"><span>الخصم</span><span className="font-mono">-{SAR(calc.discountValue)}</span></div>
            )}
            <div className="flex justify-between py-1 text-slate-600"><span>ضريبة القيمة المضافة ({vatRate}%)</span><span className="font-mono">{SAR(calc.vatTotal)}</span></div>
            <div className="grand flex justify-between py-2 mt-1 text-base font-bold bg-slate-900 text-amber-300 px-3 rounded">
              <span>الإجمالي</span><span className="total-val font-mono" dir="ltr">{SAR(calc.grandTotal)} {currency}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 text-end">
              جميع الأسعار شاملة ضريبة القيمة المضافة 15%
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TermBlock label="الدفع" value={paymentTerms} onChange={setPaymentTerms} templates={AQH_PAYMENT_TERMS} />
          <TermBlock label="التسليم" value={deliveryTerms} onChange={setDeliveryTerms} templates={AQH_DELIVERY_TERMS} />
          <TermBlock label="الضمان" value={warrantyTerms} onChange={setWarrantyTerms} templates={AQH_WARRANTY_TERMS} />
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-widest text-amber-600 font-semibold">ملاحظات</div>
            <TemplatePicker
              templates={AQH_NOTES_TEMPLATES}
              onPick={(v) => setNotesText((prev) => (prev ? prev + "\n" : "") + v)}
              label="إضافة ملاحظة جاهزة"
            />
          </div>
          <Textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder="أي ملاحظات إضافية…" rows={2} className="bg-slate-50 border-slate-200 text-slate-700 no-print-border" />
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="text-center">
            <div className="border-t-2 border-slate-300 pt-2 text-xs text-slate-500">توقيع العميل</div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-slate-300 pt-2 text-xs text-slate-500">توقيع المسؤول</div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 flex flex-wrap gap-x-6 gap-y-1 justify-center">
          <input value={footerPhone} onChange={(e) => setFooterPhone(e.target.value)} className="bg-transparent outline-none text-center no-print-border" />
          <input value={footerEmail} onChange={(e) => setFooterEmail(e.target.value)} className="bg-transparent outline-none text-center no-print-border" />
          <input value={footerVat} onChange={(e) => setFooterVat(e.target.value)} className="bg-transparent outline-none text-center no-print-border" />
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        .no-print-border { border-bottom: 1px dashed transparent; }
        .no-print-border:hover, .no-print-border:focus { border-bottom-color: #f59e0b; }
        @media print {
          @page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; }

          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden !important; }
          .quote-doc, .quote-doc * { visibility: visible !important; }
          .quote-doc {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            color: #1e293b !important;
            overflow: visible !important;
          }
          .quote-doc * {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .no-print, .no-print *,
          [data-no-print], .floating, .whatsapp-fab, [class*="fab"] {
            display: none !important;
            visibility: hidden !important;
          }
          .no-print-border { border-bottom: none !important; }
          .quote-doc input, .quote-doc textarea, .quote-doc select {
            color: #1e293b !important;
            background: transparent !important;
            border: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            resize: none !important;
            -webkit-appearance: none !important;
            appearance: none !important;
            overflow: visible !important;
            text-overflow: clip !important;
            width: auto !important;
            min-width: 0 !important;
          }
          .quote-doc textarea { min-height: auto !important; overflow: hidden !important; width: 100% !important; }
          .quote-doc input[type="date"] { width: auto !important; }
          .quote-doc table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          .quote-doc th, .quote-doc td {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            padding: 6px !important;
          }
          .quote-doc table input, .quote-doc table textarea {
            width: 100% !important;
          }
          .quote-doc .overflow-x-auto, .quote-doc .overflow-y-auto, .quote-doc .overflow-auto {
            overflow: visible !important;
          }
          .quote-doc .grand {
            padding: 10px 14px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .quote-doc tr, .quote-doc section, .quote-doc .break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          /* v2 fixes: prevent left-edge clipping of eyebrow + date inputs */
          .quote-doc .quote-eyebrow {
            padding-inline: 4px !important;
            overflow: visible !important;
            white-space: nowrap !important;
            text-overflow: clip !important;
          }
          .quote-doc .quote-no {
            padding-inline-start: 4px !important;
            letter-spacing: 0 !important;
            overflow: visible !important;
            white-space: nowrap !important;
          }
          .quote-doc .quote-header-meta { padding-inline-start: 6px !important; }
          .quote-doc input.quote-date,
          .quote-doc input[type="date"] {
            width: auto !important;
            min-width: max-content !important;
            direction: rtl !important;
            text-align: right !important;
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: nowrap !important;
            padding-inline: 2px !important;
            text-indent: 0 !important;
          }
          .quote-doc .grand { padding: 12px 18px !important; }
          .quote-doc .grand .total-val {
            padding-inline-start: 4px !important;
            overflow: visible !important;
            white-space: nowrap !important;
          }

        }
      `}</style>
    </div>
  );
}

function TemplatePicker({ templates, onPick, label }: { templates: string[]; onPick: (v: string) => void; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="no-print h-7 text-[11px] gap-1 px-2">
          <ListPlus size={12} /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto w-[360px]">
        {templates.map((t, i) => (
          <DropdownMenuItem key={i} onClick={() => onPick(t)} className="text-xs whitespace-normal leading-relaxed cursor-pointer">
            {t}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TermBlock({ label, value, onChange, templates }: { label: string; value: string; onChange: (v: string) => void; templates?: string[] }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] uppercase tracking-widest text-amber-600 font-semibold">{label}</div>
        {templates && templates.length > 0 && (
          <TemplatePicker
            templates={templates}
            onPick={(v) => onChange(v)}
            label="اختر قالب"
          />
        )}
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="bg-transparent border-none text-slate-700 text-xs p-0 resize-none focus-visible:ring-0 no-print-border" />
    </div>
  );
}
