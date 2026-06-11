import { useEffect, useState } from "react";

export function ScrollProgress() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      setW(total > 0 ? (h.scrollTop / total) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed top-0 inset-x-0 h-[2px] z-[60] pointer-events-none">
      <div
        className="h-full transition-[width] duration-150 ease-out"
        style={{
          width: `${w}%`,
          background: "linear-gradient(90deg, oklch(0.78 0.14 80), oklch(0.88 0.13 85))",
          boxShadow: "0 0 12px oklch(0.78 0.14 80 / 0.6)",
        }}
      />
    </div>
  );
}
