import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Reveal } from "../components/Reveal";
import { whatsappLink } from "../components/WhatsAppButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSessionUser } from "@/lib/client-auth";
import { CmsSlot } from "@/lib/cms/PageRenderer";

export const Route = createFileRoute("/consultation")({
  head: () => ({
    meta: [
      { title: "استشارة متخصصة — أكوا هيفن" },
      { name: "description", content: "اطلب استشارة احترافية من خبراء أكوا هيفن لتأسيس أو تطوير حوضك." },
      { property: "og:title", content: "استشارة متخصصة — أكوا هيفن" },
      { property: "og:description", content: "أرسل تفاصيل حوضك واحصل على توصية متخصصة." },
      { property: "og:url", content: "/consultation" },
    ],
    links: [{ rel: "canonical", href: "/consultation" }],
  }),
  component: ConsultationPage,
});

const tankTypes = ["نهري مزروع", "نهري عادي", "بحري ريف", "بحري سمك فقط", "غير محدد"] as const;
const goals = ["تأسيس حوض جديد", "تطوير حوض حالي", "حل مشكلة (طحالب/أمراض/تعكر)", "اختيار أسماك أو نباتات", "اختيار معدات", "أخرى"] as const;

function ConsultationPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tankType, setTankType] = useState<(typeof tankTypes)[number]>("غير محدد");
  const [goal, setGoal] = useState<(typeof goals)[number]>("تأسيس حوض جديد");
  const [size, setSize] = useState("");
  const [details, setDetails] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const user = await getSessionUser();
    const payload: { name: string; phone: string; tank_type: string; goal: string; size: string; details: string; user_id?: string } = {
      name, phone, tank_type: tankType, goal, size, details,
    };
    if (user) payload.user_id = user.id;
    const { error } = await supabase.from("consultation_requests").insert(payload);
    if (error) { toast.error("تعذر إرسال الاستشارة"); return; }
    toast.success("تم استلام استشارتك، سنتواصل معك قريباً");
    const text =
      `السلام عليكم، أرغب بحجز استشارة.\n` +
      `الاسم: ${name}\n` +
      `الجوال: ${phone}\n` +
      `نوع الحوض: ${tankType}\n` +
      `الحجم/المقاس: ${size || "—"}\n` +
      `الهدف من الاستشارة: ${goal}\n` +
      `تفاصيل إضافية:\n${details}`;
    window.open(whatsappLink(text), "_blank");
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <CmsSlot pageKey="consultation" />

      <Reveal delay={120}>

          <form onSubmit={onSubmit} className="glass rounded-3xl p-8 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm mb-2">الاسم</label>
                <input required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60"
                  placeholder="اسمك الكامل" />
              </div>
              <div>
                <label className="block text-sm mb-2">الجوال</label>
                <input required type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 text-right"
                  placeholder="05xxxxxxxx" />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm mb-2">نوع الحوض</label>
                <select value={tankType} onChange={(e) => setTankType(e.target.value as (typeof tankTypes)[number])}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60">
                  {tankTypes.map((t) => <option key={t} value={t} className="bg-background">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">المقاس / الحجم</label>
                <input value={size} onChange={(e) => setSize(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60"
                  placeholder="مثال: 80×40×40 — 130 لتر" />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-2">الهدف من الاستشارة</label>
              <select value={goal} onChange={(e) => setGoal(e.target.value as (typeof goals)[number])}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60">
                {goals.map((g) => <option key={g} value={g} className="bg-background">{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-2">اشرح تفاصيل استشارتك</label>
              <textarea required rows={6} value={details} onChange={(e) => setDetails(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 resize-none"
                placeholder="اكتب الوضع الحالي، المشكلة، أو ما الذي تطمح له..." />
            </div>
            <button type="submit" className="btn-gold w-full rounded-xl px-6 py-3.5 text-sm">
              إرسال الاستشارة عبر واتساب
            </button>
          </form>
        </Reveal>
    </div>
  );
}

}
