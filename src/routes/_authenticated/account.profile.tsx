import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSessionUser } from "@/lib/client-auth";

export const Route = createFileRoute("/_authenticated/account/profile")({
  component: ProfilePage,
});

const SA_CITIES = [
  "الرياض", "جدة", "مكة", "المدينة", "الدمام", "الخبر", "الطائف", "تبوك",
  "أبها", "القصيم", "حائل", "نجران", "جازان", "الأحساء", "الجبيل", "ينبع",
  "عرعر", "سكاكا", "أخرى",
];

function isValidSaudiPhone(raw: string): boolean {
  const v = raw.replace(/\s|-/g, "");
  return /^05\d{8}$/.test(v) || /^\+9665\d{8}$/.test(v);
}

function ProfilePage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sallaOrderNo, setSallaOrderNo] = useState("");
  const [orderVerified, setOrderVerified] = useState(false);
  const [consultsTotal, setConsultsTotal] = useState(0);
  const [consultsUsed, setConsultsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const user = await getSessionUser();
      if (!user) { setLoading(false); return; }
      setEmail(user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone, city, birth_date, salla_order_no, order_verified, free_consults_total, free_consults_used" as any)
        .eq("id", user.id)
        .maybeSingle();
      const row = (p ?? {}) as any;
      setName(row.full_name ?? "");
      setPhone(row.phone ?? "");
      setCity(row.city ?? "");
      setBirthDate(row.birth_date ?? "");
      setSallaOrderNo(row.salla_order_no ?? "");
      setOrderVerified(!!row.order_verified);
      setConsultsTotal(Number(row.free_consults_total ?? 0));
      setConsultsUsed(Number(row.free_consults_used ?? 0));
      setLoading(false);
    })();
  }, []);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "الاسم مطلوب";
    if (!phone.trim()) e.phone = "رقم الجوال مطلوب";
    else if (!isValidSaudiPhone(phone.trim())) e.phone = "صيغة الجوال غير صحيحة (05xxxxxxxx أو +9665xxxxxxxx)";
    if (!city) e.city = "اختر المدينة";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const user = await getSessionUser();
    if (!user) { setSaving(false); return; }
    const payload: any = {
      id: user.id,
      full_name: name.trim(),
      phone: phone.trim(),
      city,
      birth_date: birthDate || null,
      salla_order_no: sallaOrderNo.trim() || null,
    };
    const { error } = await supabase.from("profiles").upsert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("تم حفظ بياناتك");
  };

  const fieldCls = "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 focus:outline-none focus:border-[color:var(--gold)]/60";
  const errCls = "text-xs text-red-400 mt-1";
  const consultsLeft = Math.max(0, consultsTotal - consultsUsed);
  const hasPending = !!sallaOrderNo && !orderVerified;

  if (loading) {
    return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold mb-1">ملفي الشخصي</h1>
        <p className="text-sm text-muted-foreground">حدّث بياناتك حتى نقدر نخدمك بشكل أفضل.</p>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {orderVerified ? (
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs bg-[color:var(--gold)]/15 border border-[color:var(--gold)]/30 text-[color:var(--gold)]">
            ✓ طلبك موثّق · {consultsLeft} استشارة مجانية متاحة
          </span>
        ) : hasPending ? (
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-muted-foreground">
            ⏳ طلبك قيد التحقق
          </span>
        ) : null}
      </div>

      <div className="glass rounded-2xl p-6 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-xs text-muted-foreground block mb-1">البريد الإلكتروني</span>
          <input disabled value={email} dir="ltr" className={`${fieldCls} opacity-70 cursor-not-allowed`} />
          <div className="text-[11px] text-muted-foreground mt-1">لا يمكن تعديل البريد من هنا.</div>
        </label>

        <label>
          <span className="text-xs text-muted-foreground block mb-1">الاسم الكامل</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
          {errors.name && <div className={errCls}>{errors.name}</div>}
        </label>

        <label>
          <span className="text-xs text-muted-foreground block mb-1">رقم الجوال</span>
          <input
            value={phone}
            dir="ltr"
            placeholder="05XXXXXXXX"
            onChange={(e) => setPhone(e.target.value)}
            className={`${fieldCls} text-right`}
          />
          {errors.phone && <div className={errCls}>{errors.phone}</div>}
        </label>

        <label>
          <span className="text-xs text-muted-foreground block mb-1">المدينة</span>
          <div className="relative">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={`${fieldCls} appearance-none pe-10 bg-[#0b1424]`}
            >
              <option value="">اختر المدينة...</option>
              {SA_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={16} className="absolute inset-y-0 start-3 my-auto text-muted-foreground pointer-events-none" />
          </div>
          {errors.city && <div className={errCls}>{errors.city}</div>}
        </label>

        <label>
          <span className="text-xs text-muted-foreground block mb-1">
            تاريخ الميلاد <span className="text-muted-foreground">(اختياري)</span>
          </span>
          <input
            type="date"
            dir="ltr"
            value={birthDate ?? ""}
            onChange={(e) => setBirthDate(e.target.value)}
            className={`${fieldCls} text-right`}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="text-xs text-muted-foreground block mb-1">
            رقم طلب سلة <span className="text-muted-foreground">(لو شريت حوض جاهز)</span>
          </span>
          <input
            value={sallaOrderNo}
            dir="ltr"
            placeholder="رقم الطلب من سلة"
            onChange={(e) => setSallaOrderNo(e.target.value)}
            disabled={orderVerified}
            className={`${fieldCls} text-right ${orderVerified ? "opacity-70 cursor-not-allowed" : ""}`}
          />
          <div className="text-[11px] text-muted-foreground mt-1">
            {orderVerified
              ? "تم التحقق من طلبك وتفعيل استشاراتك المجانية."
              : "سيتم التحقق منه يدويًا وتفعيل استشاراتك المجانية."}
          </div>
        </label>

        <div className="sm:col-span-2 flex justify-end">
          <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-5 py-2 text-sm">
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}
