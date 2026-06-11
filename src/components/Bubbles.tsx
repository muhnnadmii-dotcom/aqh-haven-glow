export function Bubbles({ count = 18 }: { count?: number }) {
  const bubbles = Array.from({ length: count }, (_, i) => {
    const size = 6 + Math.random() * 28;
    const left = Math.random() * 100;
    const duration = 10 + Math.random() * 18;
    const delay = -Math.random() * duration;
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
