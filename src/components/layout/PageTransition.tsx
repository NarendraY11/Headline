import React, { Suspense } from "react";

import { LoadingFallback } from './LoadingFallback';

// CSS-only fade/slide on route change. Keyed remount restarts the @keyframes,
// so the always-mounted route shell no longer pulls the animation runtime into
// the critical path. Animation defined as `page-enter` in index.css.
export function PageTransition({ children, keyId }: { children: React.ReactNode, keyId?: string }) {
  return (
    <div key={keyId} className="w-full h-full page-enter">
      <Suspense fallback={<LoadingFallback />}>
        {children}
      </Suspense>
    </div>
  );
}
