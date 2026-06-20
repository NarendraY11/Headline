import React, { useEffect, useRef, useState } from "react";

export const FadeUp: React.FC<{ children: React.ReactNode, delay?: number, className?: string, immediate?: boolean }> = ({ children, delay = 0, className = "", immediate = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  // ponytail: immediate=true skips IO so above-fold LCP elements paint on first frame
  const [inView, setInView] = useState(immediate);

  useEffect(() => {
    if (immediate) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { rootMargin: "-50px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [immediate]);

  return (
    <div
      ref={ref}
      className={`fade-up ${inView ? "fade-up-in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
