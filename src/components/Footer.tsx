import { Link } from "@tanstack/react-router";
import { Instagram, MapPin, Phone } from "lucide-react";
import aqhLogo from "@/assets/aqh-logo.png.asset.json";
import { useNavLinks, FOOTER_FALLBACK, navLabel, type SiteNavLink } from "@/lib/site-nav";
import { useLang } from "@/lib/i18n/LangProvider";
import type { Lang } from "@/lib/i18n/strings";

function FooterLink({ l, lang }: { l: SiteNavLink; lang: Lang }) {
  const label = navLabel(l, lang);
  if (l.external || /^https?:\/\//i.test(l.href)) {
    return (
      <a href={l.href} target={l.open_in_new_tab ? "_blank" : undefined} rel={l.open_in_new_tab ? "noopener noreferrer" : undefined} className="hover:text-foreground">
        {label}
      </a>
    );
  }
  return <Link to={l.href as any} className="hover:text-foreground">{label}</Link>;
}

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.6 6.3a5.3 5.3 0 0 1-3.1-1V16a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3a2.6 2.6 0 1 0 1.7 2.5V2h2.9a5.3 5.3 0 0 0 3.2 4.3z" />
    </svg>
  );
}

export function Footer() {
  const quickLinks = useNavLinks("footer_quick", FOOTER_FALLBACK);
  const { lang } = useLang();
  return (
    <footer className="relative mt-16 border-t border-white/10 bg-[oklch(0.10_0.05_245/0.6)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        <div className="grid gap-8 md:gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="mb-4">
              <img src={aqhLogo.url} alt="أكوا هيفن" className="h-12 w-auto" width={144} height={48} />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              عالمك المائي يبدأ من هنا. تصميم وتركيب وصيانة الأحواض المخصصة في المملكة العربية السعودية.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold mb-4 text-gradient-gold">روابط سريعة</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {quickLinks.map((l) => (
                <li key={l.id}><FooterLink l={l} lang={lang} /></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold mb-4 text-gradient-gold">تواصل معنا</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone size={14} className="shrink-0" />
                <a href="tel:+966527044200" dir="ltr" className="whitespace-nowrap [unicode-bidi:isolate] hover:text-foreground">
                  +966 52 704 4200
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="shrink-0 mt-0.5" />
                <span>الرياض، المملكة العربية السعودية</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="shrink-0 w-[14px]" aria-hidden />
                <a href="https://aqh.sa" target="_blank" rel="noopener noreferrer" className="hover:text-foreground" dir="ltr">
                  aqh.sa
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold mb-4 text-gradient-gold">تابعنا</h4>
            <div className="flex gap-3">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="إنستغرام"
                className="grid place-items-center h-10 w-10 rounded-xl glass hover:glass-gold transition">
                <Instagram size={18} aria-hidden />
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="تيك توك"
                className="grid place-items-center h-10 w-10 rounded-xl glass hover:glass-gold transition">
                <TikTokIcon />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 md:mt-12 pt-6 border-t border-white/5 text-center text-xs text-muted-foreground">
          أكوا هيفن © 2026 — جميع الحقوق محفوظة
        </div>
      </div>
    </footer>
  );
}
