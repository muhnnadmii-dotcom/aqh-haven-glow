export function Bubbles({ count = 18 }: { count?: number }) {
  const bubbles = Array.from({ length: count }, (_, i) => {
    const seed = (i + 1) * 9301 + count * 49297;
    const rand = (n: number) => {
      const x = Math.sin(seed + n * 233) * 10000;
      return x - Math.floor(x);
    };
    const size = 6 + rand(1) * 28;
    const left = rand(2) * 100;
    const duration = 10 + rand(3) * 18;
    const delay = -rand(4) * duration;
    return { size, left, duration, delay, id: i };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b) => (
        <span
          key={b.id}
          className="bubble"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
