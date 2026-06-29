import { Link } from "@tanstack/react-router";
import { Instagram, MapPin, Phone } from "lucide-react";
import aqhLogo from "@/assets/aqh-logo.png.asset.json";
import { useNavLinks, FOOTER_FALLBACK, type SiteNavLink } from "@/lib/site-nav";

function FooterLink({ l }: { l: SiteNavLink }) {
  if (l.external || /^https?:\/\//i.test(l.href)) {
    return (
      <a href={l.href} target={l.open_in_new_tab ? "_blank" : undefined} rel={l.open_in_new_tab ? "noopener noreferrer" : undefined} className="hover:text-foreground">
        {l.label}
      </a>
    );
  }
  return <Link to={l.href as any} className="hover:text-foreground">{l.label}</Link>;
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
  return (
    <footer className="relative mt-20 border-t border-white/10 bg-[oklch(0.10_0.05_245/0.6)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
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
              <li><Link to="/portfolio" className="hover:text-foreground">أعمالنا</Link></li>
              <li><Link to="/services" className="hover:text-foreground">خدماتنا</Link></li>
              <li><Link to="/catalog" className="hover:text-foreground">الكاتلوج</Link></li>
              <li><Link to="/knowledge" className="hover:text-foreground">مركز المعرفة</Link></li>
              <li><Link to="/about" className="hover:text-foreground">من نحن</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold mb-4 text-gradient-gold">تواصل معنا</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Phone size={14} /> +966 52 704 4200</li>
              <li className="flex items-center gap-2"><MapPin size={14} /> الرياض، المملكة العربية السعودية</li>
              <li>
                <a href="https://aqh.sa" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  المتجر الإلكتروني: aqh.sa
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

        <div className="mt-12 pt-6 border-t border-white/5 text-center text-xs text-muted-foreground">
          أكوا هيفن © 2026 — جميع الحقوق محفوظة
        </div>
      </div>
    </footer>
  );
}
