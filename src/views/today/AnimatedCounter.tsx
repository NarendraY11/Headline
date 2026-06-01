import { animate } from "motion/react";
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
    const controls = animate(0, value, {
      duration: duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplayValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}
