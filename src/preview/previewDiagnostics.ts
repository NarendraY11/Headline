import { useEffect, useRef } from "react";

const SLOW_PREVIEW_THRESHOLD_MS = Number(
  import.meta.env.VITE_PREVIEW_SLOW_THRESHOLD_MS ?? 16
);

export function usePreviewRenderDiagnostics(name: string) {
  const renderCountRef = useRef(0);
  const renderStartedAtRef = useRef(0);

  if (import.meta.env.DEV) {
    renderCountRef.current += 1;
    renderStartedAtRef.current = performance.now();
  }

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const duration = performance.now() - renderStartedAtRef.current;
    console.debug(`[preview] ${name} render #${renderCountRef.current} (${duration.toFixed(1)}ms)`);

    if (duration > SLOW_PREVIEW_THRESHOLD_MS) {
      console.warn(
        `[preview] Slow render detected in ${name}: ${duration.toFixed(1)}ms`
      );
    }
  });
}

let hasWarnedAboutRegistry = false;

export function warnPreviewRegistryIssues(message: string) {
  if (!import.meta.env.DEV || hasWarnedAboutRegistry) {
    return;
  }

  hasWarnedAboutRegistry = true;
  console.warn(`[preview] ${message}`);
}

