import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { to: "/", label: "الرئيسية" },
  { to: "/portfolio", label: "أعمالنا" },
  { to: "/services", label: "خدماتنا" },
  { to: "/catalog", label: "الكاتلوج" },
  { to: "/knowledge", label: "مركز المعرفة" },
  { to: "/about", label: "من نحن" },
  { to: "/contact", label: "تواصل معنا" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div
        className={`mx-auto max-w-7xl px-4 sm:px-6 transition-all duration-300 ${
          scrolled ? "" : ""
        }`}
      >
        <div
          className={`glass flex items-center justify-between rounded-2xl px-4 sm:px-6 py-3 transition-all ${
            scrolled ? "shadow-deep" : ""
          }`}
        >
          <Link to="/" className="flex items-center gap-2">
            <img src={aqhLogo.url} alt="أكوا هيفن" className="h-10 w-auto" width={120} height={40} />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground rounded-lg"
                activeProps={{ className: "px-3 py-2 text-sm text-foreground font-semibold rounded-lg" }}
                activeOptions={{ exact: true }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="https://aqh.sa"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold hidden sm:inline-flex items-center rounded-xl px-5 py-2.5 text-sm"
            >
              تسوق الآن
            </a>
            <button
              onClick={() => setOpen(!open)}
              className="lg:hidden grid place-items-center h-10 w-10 rounded-xl glass"
              aria-label="القائمة"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden mt-2 glass rounded-2xl p-3 flex flex-col">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-sm rounded-lg hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
            <a
              href="https://aqh.sa"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold mt-2 text-center rounded-xl px-5 py-3 text-sm"
            >
              تسوق الآن
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
