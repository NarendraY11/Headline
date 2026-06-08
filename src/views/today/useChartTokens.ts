import { useEffect, useState } from "react";

// Reads the live design-token hex/rgba values off :root so recharts/d3 charts
// (which take colors as plain string props, not CSS classes) paint correctly in
// BOTH light and dark mode. We read the BASE tokens (`--ink`, `--navy`, …) and
// NOT the `--color-*` aliases: unregistered custom properties keep their
// unsubstituted `var(--ink)` text under getComputedStyle, so the aliases would
// return useless "var(--ink)" strings — the base tokens hold real values.
const readVar = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

export interface ChartTokens {
  ink: string;
  navy: string;
  muted: string;
  muted2: string;
  rule: string;
  paper: string;
  signal: string;
  sky: string;
}

const read = (): ChartTokens => ({
  ink: readVar("--ink", "#0d1a2d"),
  navy: readVar("--navy", "#14305a"),
  muted: readVar("--muted", "#334155"),
  muted2: readVar("--muted-2", "#475569"),
  rule: readVar("--rule", "rgba(13,26,45,0.10)"),
  paper: readVar("--paper", "#ffffff"),
  signal: readVar("--signal", "#c2402e"),
  sky: readVar("--sky", "#2f6098"),
});

// Re-reads when the `.dark` class on <html> toggles so charts recolor live.
export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(read);
  useEffect(() => {
    setTokens(read());
    const obs = new MutationObserver(() => setTokens(read()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return tokens;
}
