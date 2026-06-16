import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  /** Tailwind / inline class for the outer div — must establish a block height */
  className?: string;
  children: ReactNode;
  /** Fallback rendered while dimensions are being measured (default: nothing) */
  fallback?: ReactNode;
  /** Passed through to the outer div for accessibility */
  role?: string;
  "aria-label"?: string;
}

/**
 * Wrapper that defers chart rendering until the container has positive
 * dimensions. Fixes the recharts "width(-1) and height(-1)" warning that
 * fires when a chart mounts inside a hidden tab or before layout completes.
 *
 * Usage:
 *   <ChartContainer className="h-[200px] w-full">
 *     <ResponsiveContainer width="100%" height="100%">
 *       ...
 *     </ResponsiveContainer>
 *   </ChartContainer>
 */
export function ChartContainer({ className, children, fallback = null, role, "aria-label": ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial synchronous check (covers cases where layout is already done).
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setReady(true);
      return;
    }

    // Async fallback via ResizeObserver for hidden-tab / deferred-paint cases.
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setReady(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} role={role} aria-label={ariaLabel}>
      {ready ? children : fallback}
    </div>
  );
}
