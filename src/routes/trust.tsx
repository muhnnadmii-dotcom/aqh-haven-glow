import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "الخصوصية والثقة — أكوا هيفن" },
      {
        name: "description",
        content:
          "صفحة يحرّرها فريق أكوا هيفن لتوضيح ممارسات الخصوصية والأمان وكيفية التعامل مع بيانات العملاء.",
      },
      { property: "og:title", content: "الخصوصية والثقة — أكوا هيفن" },
      {
        property: "og:description",
        content: "ممارسات الخصوصية والأمان في أكوا هيفن.",
      },
      { property: "og:url", content: "/trust" },
    ],
    links: [{ rel: "canonical", href: "/trust" }],
  }),
  component: TrustPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <section className="rounded-2xl border border-border bg-card/40 p-6 md:p-8">
        <h2 className="mb-3 text-xl md:text-2xl font-semibold text-foreground">{title}</h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
      </section>
    </Reveal>
  );
}

function TrustPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="mb-10 text-center">
        <p className="text-sm text-primary mb-2">الخصوصية والثقة</p>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          كيف نتعامل مع بياناتك في أكوا هيفن
        </h1>
        <p className="mt-4 text-muted-foreground">
          هذه الصفحة يُحرِّرها ويُحدِّثها فريق أكوا هيفن للإجابة عن الأسئلة الشائعة حول الخصوصية
          والأمان. ليست شهادة موثَّقة من جهة خارجية، بل توضيح لممارساتنا الحالية.
        </p>
      </header>

      <div className="space-y-5">
        <Section title="البيانات التي نجمعها">
          <p>
            نجمع فقط البيانات التي تحتاجها خدماتنا للعمل: الاسم، رقم الجوال، المدينة، وتفاصيل الطلب
            (نوع الحوض، الصور المرفقة من قِبَلك، الملاحظات). لا نجمع بيانات بنكية ولا أرقام هويات.
          </p>
        </Section>

        <Section title="كيف نستخدم البيانات">
          <p>
            تُستخدم البيانات للتواصل معك، تجهيز عرض السعر، تنفيذ الزيارة أو التركيب، وإدارة عقود
            الصيانة. لا نبيع بياناتك ولا نشاركها مع جهات تسويقية.
          </p>
        </Section>

        <Section title="الحساب وتسجيل الدخول">
          <p>
            تسجيل الدخول يتم عبر بريدك الإلكتروني أو حساب Google. كلمة المرور لا تُخزَّن عندنا
            مباشرة، بل عبر مزوّد المصادقة المستضاف. الجلسات تنتهي تلقائيًا، ويمكنك تسجيل الخروج في
            أي وقت من صفحة حسابك.
          </p>
        </Section>

        <Section title="صلاحيات الوصول داخل الفريق">
          <p>
            الوصول إلى بيانات العملاء مقصور على فريق العمليات (الإدارة والموظفين) عبر لوحة الإدارة.
            العميل لا يرى إلا طلباته وأحواضه ومواعيده فقط. صلاحيات الإدارة محميّة بسياسات وصول
            على مستوى قاعدة البيانات.
          </p>
        </Section>

        <Section title="الصور والملفات">
          <p>
            الصور التي ترفعها مع طلبك (صور المكان أو الحوض الحالي) تُحفظ في تخزين خاص بالمشروع
            وتُستخدم فقط لخدمة طلبك. يمكنك طلب حذفها في أي وقت بالتواصل معنا.
          </p>
        </Section>

        <Section title="الاحتفاظ بالبيانات والحذف">
          <p>
            نحتفظ بسجلات الطلبات والصيانة لأغراض المتابعة والضمان. للحذف أو لتصدير نسخة من بياناتك،
            تواصل معنا عبر صفحة <Link to="/contact" className="text-primary underline">تواصل معنا</Link>
            وسنرد خلال أيام عمل قليلة.
          </p>
        </Section>

        <Section title="مزوّدو الخدمة">
          <p>
            نعتمد على مزوّدين موثوقين للاستضافة وقواعد البيانات والمصادقة وإرسال الإشعارات.
            هؤلاء المزوّدون مُلزَمون تعاقديًا بحماية البيانات ولا يستخدمونها لأغراض أخرى.
          </p>
        </Section>

        <Section title="التواصل والإبلاغ">
          <p>
            لأي سؤال يخص الخصوصية أو الأمان أو للإبلاغ عن مشكلة محتملة، يُرجى التواصل معنا عبر صفحة{" "}
            <Link to="/contact" className="text-primary underline">تواصل معنا</Link>. نأخذ كل بلاغ
            بجدّية ونرد في أسرع وقت ممكن.
          </p>
        </Section>

        <p className="text-xs text-muted-foreground/70 text-center pt-4">
          هذه الصفحة محتوى يديره فريق أكوا هيفن. تخضع للتحديث عند تغيّر ممارساتنا أو خدماتنا.
        </p>
      </div>
    </main>
  );
}
