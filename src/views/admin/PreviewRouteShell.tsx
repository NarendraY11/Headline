import { memo, type ReactNode } from "react";
import { Eye, Route, ShieldOff } from "lucide-react";
import { useFeature } from "../../hooks/useFeatureFlags";
import type { FeatureDefinition } from "./featureRegistry";

interface PreviewRouteShellProps {
  children: ReactNode;
  embedded?: boolean;
  feature: FeatureDefinition;
  routePath: string;
  summary?: string;
}

function PreviewRouteShellInner({
  children,
  embedded = false,
  feature,
  routePath,
  summary,
}: PreviewRouteShellProps) {
  const enabled = Boolean(useFeature(feature.key));

  return (
    <div className={embedded ? "h-full bg-bg" : "mx-auto max-w-6xl"}>
      <div className={embedded ? "border-b border-rule bg-paper px-4 py-3" : "mb-5 rounded-xl border border-rule-strong bg-paper px-5 py-4"}>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-2">
          <Route size={12} className="text-ink" />
          Route Preview
          <span className="text-rule-strong">/</span>
          <span>{feature.key}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-lg text-ink">{feature.title}</h3>
          <span className="rounded-full border border-rule px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            {enabled ? "enabled" : "disabled"}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">{summary || feature.description}</p>
        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-2">
          <Eye size={11} />
          <span>{routePath}</span>
        </div>
      </div>

      {!enabled ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-xl border-t border-rule bg-bg-2/50 px-6 py-10 text-center">
          <ShieldOff size={28} className="text-muted-2" />
          <h4 className="mt-4 font-serif text-xl text-ink">Route hidden while flag is off</h4>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Preview mode is respecting the current draft state. This route stays unavailable until{" "}
            <span className="font-medium text-ink">{feature.title}</span> is turned back on.
          </p>
        </div>
      ) : (
        <div className={embedded ? "max-h-[640px] overflow-auto" : ""}>{children}</div>
      )}
    </div>
  );
}

export const PreviewRouteShell = memo(PreviewRouteShellInner);
