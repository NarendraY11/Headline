import { lazy, memo, Suspense } from "react";
import { AlertCircle, Eye, Loader2, MousePointerClick } from "lucide-react";
import { PreviewFeatureFlagsProvider } from "../../preview/PreviewFeatureFlagsProvider";
import { PreviewErrorBoundary } from "../../preview/PreviewErrorBoundary";
import { usePreviewDraftFlags, usePreviewPanelState, usePreviewSelection } from "../../preview/usePreviewMode";
import { usePreviewRenderDiagnostics } from "../../preview/previewDiagnostics";
import { featurePreviewRegistry } from "./featurePreviewRegistry";
import { FeaturePreviewUnavailable } from "./FeaturePreviewUnavailable";

const LazyFeaturePreviewRoute = lazy(() => import("./FeaturePreviewRoute"));

function PreviewPanelLoadingFallback({
  title = "Loading preview",
  subtitle = "Preparing isolated preview state.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      role="status"
      aria-label={title}
      className="h-full min-h-[220px] rounded-xl border border-rule-strong bg-paper p-6 flex flex-col items-center justify-center text-center"
    >
      <Loader2 size={24} className="text-ink mb-3 animate-spin" aria-hidden="true" />
      <h3 className="font-serif text-base text-ink mb-1">{title}</h3>
      <p className="font-sans text-xs text-muted-2">{subtitle}</p>
    </div>
  );
}

function FeaturePreviewPanelInner() {
  usePreviewRenderDiagnostics("FeaturePreviewPanel");
  const { draftFlags } = usePreviewDraftFlags();
  const { selectedFeature: feature } = usePreviewSelection();
  const { status, error } = usePreviewPanelState();

  if (status === "idle") {
    return (
      <div
        aria-label="Preview workspace — select a feature to begin"
        className="h-full min-h-[280px] rounded-xl border border-rule-strong bg-paper p-6 flex flex-col items-center justify-center text-center"
      >
        <MousePointerClick size={24} className="text-muted-2 mb-3" aria-hidden="true" />
        <h3 className="font-serif text-base text-ink mb-1">No feature selected</h3>
        <p className="font-sans text-xs text-muted-2 max-w-sm leading-relaxed">
          Select a feature on the left to open its preview workspace.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return <PreviewPanelLoadingFallback />;
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="h-full min-h-[220px] rounded-xl border border-rose-200 bg-rose-50/50 p-6 flex flex-col items-center justify-center text-center"
      >
        <AlertCircle size={24} className="text-rose-600 mb-3" aria-hidden="true" />
        <h3 className="font-serif text-base text-ink mb-1">Preview error</h3>
        <p className="font-sans text-xs text-muted-2 max-w-sm leading-relaxed">
          {error || "The preview panel could not prepare this feature."}
        </p>
      </div>
    );
  }

  if (!feature || status === "unavailable") {
    return <FeaturePreviewUnavailable feature={feature} />;
  }

  const preview = featurePreviewRegistry[feature.key];
  const PreviewComponent = preview.previewComponent;
  const hasRoutePreview = preview.previewType === "route" && preview.previewRoute;

  return (
    <section
      aria-label={`Preview: ${feature.title}`}
      className="h-full min-h-[220px] rounded-xl border border-rule-strong bg-paper overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-rule/60 bg-bg-2/60 flex items-center gap-2">
        <Eye size={14} className="text-ink" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-serif text-base text-ink leading-tight truncate">{feature.title}</h3>
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
            {preview.previewType} preview — {preview.implementationStatus}
          </p>
        </div>
      </div>

      {hasRoutePreview ? (
        <PreviewErrorBoundary featureKey={feature.key} context="route">
          <Suspense
            fallback={
              <PreviewPanelLoadingFallback subtitle="Loading route preview module." />
            }
          >
            <LazyFeaturePreviewRoute embedded featureKey={feature.key} />
          </Suspense>
        </PreviewErrorBoundary>
      ) : PreviewComponent ? (
        <PreviewErrorBoundary featureKey={feature.key} context="component">
          <PreviewFeatureFlagsProvider draftFlags={draftFlags}>
            <Suspense
              fallback={
                <PreviewPanelLoadingFallback subtitle="Loading component preview module." />
              }
            >
              <PreviewComponent />
            </Suspense>
          </PreviewFeatureFlagsProvider>
        </PreviewErrorBoundary>
      ) : (
        <FeaturePreviewUnavailable
          feature={feature}
          message="Live preview infrastructure is connected. This feature does not have a component preview yet."
        />
      )}
    </section>
  );
}

export const FeaturePreviewPanel = memo(FeaturePreviewPanelInner);
