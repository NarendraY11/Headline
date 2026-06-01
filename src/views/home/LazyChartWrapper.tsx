import React, { useState, useEffect, lazy, Suspense, useRef } from "react";

const HomeProgressChart = lazy(() => import("../../components/HomeProgressChart"));

export function LazyChartWrapper() {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full relative flex-1 min-h-[200px]" role="img" aria-label="A bar chart showing student scores across the last 7 learning sessions, indicating an improvement trend from 62% to 88% accuracy">
      <Suspense fallback={<div className="w-full h-[200px] bg-bg-2 animate-pulse rounded-md" />}>
        {inView ? <HomeProgressChart /> : <div className="w-full h-[200px] bg-bg-2 animate-pulse rounded-md" />}
      </Suspense>
    </div>
  );
}
