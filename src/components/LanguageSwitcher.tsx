import { Globe } from "lucide-react";
import { useLang } from "@/lib/i18n/LangProvider";

export function LanguageSwitcher({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { lang, setLang } = useLang();
  const target = lang === "ar" ? "en" : "ar";
  const label = lang === "ar" ? "EN" : "AR";
  const title = lang === "ar" ? "Switch to English" : "التبديل إلى العربية";
  return (
    <button
      type="button"
      onClick={() => setLang(target)}
      aria-label={title}
      title={title}
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-2 text-xs glass hover:bg-white/10 border border-white/10 text-foreground/90 transition-colors"
      }
    >
      <Globe size={14} />
      {!compact && <span className="font-semibold tracking-wide">{label}</span>}
    </button>
  );
}
