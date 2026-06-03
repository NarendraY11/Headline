import { useEffect, useState } from "react";

export function AnimatedCounter({
  value,
  duration = 1.5,
}: {
  value: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof requestAnimationFrame === "undefined") {
      setDisplayValue(value);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const durationMs = duration * 1000;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      // easeOut (cubic)
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}
