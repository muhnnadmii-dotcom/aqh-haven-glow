import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, User, Shield, MessageCircle, LayoutDashboard, Inbox, Fish, Calendar, LogOut } from "lucide-react";
import aqhLogo from "@/assets/aqh-logo.png.asset.json";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/components/WhatsAppButton";

const links = [
  { to: "/", label: "الرئيسية" },
  { to: "/portfolio", label: "أعمالنا" },
  { to: "/services", label: "الخدمات" },
  { to: "/maintenance", label: "الصيانة" },
  { to: "/business-solutions", label: "حلول الأعمال" },
  { to: "/knowledge", label: "مركز المعرفة" },
  { to: "/contact", label: "تواصل معنا" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) { setDisplayName(""); return; }
    let active = true;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const fn = (data?.full_name as string) || (user.email?.split("@")[0] ?? "");
        setDisplayName(fn);
      });
    return () => { active = false; };
  }, [user]);

  const firstName = displayName ? displayName.split(" ")[0] : "";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const waLink = whatsappLink("السلام عليكم، أرغب بطلب خدمة من أكوا هيفن.");

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "py-1.5 sm:py-2" : "py-2 sm:py-4"
        }`}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          <div
            className={`glass flex items-center justify-between rounded-2xl px-3 sm:px-6 py-2 sm:py-3 transition-all ${
              scrolled ? "shadow-deep" : ""
            }`}
          >
            <Link to="/" className="flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
              <img
                src={aqhLogo.url}
                alt="أكوا هيفن"
                className="h-7 sm:h-10 w-auto"
                width={120}
                height={40}
              />
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="relative px-3 py-2 text-sm text-muted-foreground transition-all duration-300 hover:text-[#D4A017] rounded-lg group"
                  activeProps={{
                    className:
                      "relative px-3 py-2 text-sm text-[#D4A017] font-semibold rounded-lg",
                  }}
                  activeOptions={{ exact: true }}
                >
                  <span>{l.label}</span>
                  <span className="pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 origin-center scale-x-0 bg-gradient-to-r from-transparent via-[#D4A017] to-transparent transition-transform duration-300 group-hover:scale-x-100" />
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-2 text-xs bg-[#D4A017]/15 border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017]/25 transition-colors"
                  title="لوحة الإدارة"
                  aria-label="لوحة الإدارة"
                >
                  <Shield size={14} />
                  <span className="hidden sm:inline">الإدارة</span>
                </Link>
              )}
              {user ? (
                <Link
                  to="/account"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm bg-[color:var(--gold)]/15 border border-[color:var(--gold)]/30 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/25 transition-colors"
                  title="لوحة العميل"
                >
                  <LayoutDashboard size={14} />
                  <span className="hidden sm:inline">لوحة العميل</span>
                  {firstName && <span className="hidden md:inline text-foreground/80">· {firstName}</span>}
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="hidden sm:inline-flex items-center glass rounded-xl px-4 py-2 text-sm hover:bg-white/10 transition-colors"
                >
                  دخول
                </Link>
              )}

              {/* Primary WhatsApp CTA — always visible */}
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="اطلب عبر واتساب"
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.03] hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
              >
                <MessageCircle size={15} className="sm:hidden" />
                <span className="hidden sm:inline">اطلب عبر واتساب</span>
                <span className="sm:hidden">واتساب</span>
              </a>

              {/* Secondary — shop */}
              <a
                href="https://aqh.sa"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold hidden md:inline-flex items-center rounded-xl px-4 py-2.5 text-sm"
              >
                تسوق الآن
              </a>

              <button
                onClick={() => setOpen(!open)}
                className="lg:hidden grid place-items-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl glass hover:bg-white/10 transition-colors"
                aria-label="القائمة"
                aria-expanded={open}
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer — slides from right (RTL) */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute top-0 right-0 h-full w-[82%] max-w-sm bg-[#003B6F]/95 backdrop-blur-xl border-l border-[#D4A017]/20 shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <img src={aqhLogo.url} alt="أكوا هيفن" className="h-8 w-auto" />
            <button
              onClick={() => setOpen(false)}
              className="grid place-items-center h-9 w-9 rounded-xl glass hover:bg-white/10"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex flex-col px-3 py-3 overflow-y-auto max-h-[calc(100%-72px)]">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-base rounded-xl text-white/85 hover:bg-white/5 hover:text-[#D4A017] transition-colors"
                activeProps={{
                  className:
                    "px-4 py-3 text-base rounded-xl bg-[#D4A017]/15 text-[#D4A017] font-semibold border-r-2 border-[#D4A017]",
                }}
                activeOptions={{ exact: true }}
              >
                {l.label}
              </Link>
            ))}

            <div className="my-3 h-px bg-white/10" />

            {user ? (
              <>
                {firstName && (
                  <div className="px-4 pt-1 pb-2 text-xs text-white/60">مرحبًا، <span className="text-[#D4A017] font-semibold">{firstName}</span></div>
                )}
                <Link to="/account" onClick={() => setOpen(false)}
                  className="px-4 py-3 text-sm rounded-xl text-[#D4A017] bg-[#D4A017]/10 border border-[#D4A017]/20 inline-flex items-center gap-2 mb-1">
                  <LayoutDashboard size={15} /> لوحة العميل
                </Link>
                <Link to="/account/requests" onClick={() => setOpen(false)}
                  className="px-4 py-3 text-sm rounded-xl text-white/85 hover:bg-white/5 inline-flex items-center gap-2">
                  <Inbox size={14} /> طلباتي
                </Link>
                <Link to="/account/tanks" onClick={() => setOpen(false)}
                  className="px-4 py-3 text-sm rounded-xl text-white/85 hover:bg-white/5 inline-flex items-center gap-2">
                  <Fish size={14} /> أحواضي
                </Link>
                <Link to="/account/appointments" onClick={() => setOpen(false)}
                  className="px-4 py-3 text-sm rounded-xl text-white/85 hover:bg-white/5 inline-flex items-center gap-2">
                  <Calendar size={14} /> مواعيدي
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setOpen(false)}
                    className="mt-2 px-4 py-3 text-sm rounded-xl text-white/85 hover:bg-white/5 inline-flex items-center gap-2 border-t border-white/10 pt-3">
                    <Shield size={14} /> لوحة الإدارة
                  </Link>
                )}
                <button
                  onClick={async () => { await supabase.auth.signOut(); setOpen(false); }}
                  className="mt-2 px-4 py-3 text-sm rounded-xl text-rose-300 hover:bg-rose-500/10 inline-flex items-center gap-2 text-right"
                >
                  <LogOut size={14} /> تسجيل الخروج
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-sm rounded-xl text-white/85 hover:bg-white/5 inline-flex items-center gap-2"
              >
                <User size={14} /> تسجيل دخول
              </Link>
            )}

            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
            >
              <MessageCircle size={16} /> اطلب عبر واتساب
            </a>
            <a
              href="https://aqh.sa"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="btn-gold mt-2 text-center rounded-xl px-5 py-3 text-sm"
            >
              تسوق الآن
            </a>
          </nav>
        </aside>
      </div>
    </>
  );
}
