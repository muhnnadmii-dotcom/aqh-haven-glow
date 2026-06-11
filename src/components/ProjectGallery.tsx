import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProjectGallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const n = images.length;

  const next = () => setI((p) => (p + 1) % n);
  const prev = () => setI((p) => (p - 1 + n) % n);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") prev(); // RTL: right arrow = previous visually
      if (e.key === "ArrowLeft") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-2xl bg-black/30 aspect-[16/10]">
        <img
          src={images[i]}
          alt={`${alt} — صورة ${i + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        {n > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="السابق"
              className="absolute top-1/2 right-3 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-full glass-gold hover:scale-110 transition"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={next}
              aria-label="التالي"
              className="absolute top-1/2 left-3 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-full glass-gold hover:scale-110 transition"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs glass-gold">
              {i + 1} / {n}
            </div>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`صورة ${idx + 1}`}
              className={`relative shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition ${
                idx === i
                  ? "border-[color:var(--gold)]"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
