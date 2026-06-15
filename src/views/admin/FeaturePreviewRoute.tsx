import { useParams } from "react-router-dom";
import { PreviewFeatureFlagsProvider } from "../../preview/PreviewFeatureFlagsProvider";
import { PreviewErrorBoundary } from "../../preview/PreviewErrorBoundary";
import { usePreviewDraftFlags } from "../../preview/usePreviewMode";
import { defaultFlags, type FlagKeys } from "../../hooks/useFeatureFlags";
import { FeaturePreviewUnavailable } from "./FeaturePreviewUnavailable";
import { PreviewRouteShell } from "./PreviewRouteShell";
import { featureRegistry } from "./featureRegistry";
import { previewRoutes } from "./previewRoutes";

// VALID_FEATURE_KEYS guards against prototype-pollution attacks where a
// crafted :featureKey URL param like "__proto__" or "constructor" would pass
// a naive `key in featureRegistry` check due to inherited Object properties.
const VALID_FEATURE_KEYS = new Set<string>(Object.keys(featureRegistry));

interface FeaturePreviewRouteProps {
  embedded?: boolean;
  featureKey?: FlagKeys;
}

export default function FeaturePreviewRoute({
  embedded = false,
  featureKey: featureKeyProp,
}: FeaturePreviewRouteProps) {
  const { featureKey: featureKeyParam } = useParams<{ featureKey: string }>();
  const { draftFlags } = usePreviewDraftFlags();
  const rawKey = featureKeyProp ?? featureKeyParam;

  // Reject keys not in the explicit allow-set (blocks "__proto__", "constructor", etc.)
  if (!rawKey || !VALID_FEATURE_KEYS.has(rawKey)) {
    return (
      <FeaturePreviewUnavailable message="This preview route does not map to a known feature flag." />
    );
  }

  const featureKey = rawKey as FlagKeys;
  const feature = featureRegistry[featureKey];
  const routePreview = previewRoutes[featureKey];

  if (!routePreview) {
    return (
      <FeaturePreviewUnavailable
        feature={feature}
        message="A dedicated route preview has not been implemented for this feature yet."
      />
    );
  }

  const RouteComponent = routePreview.component;

  return (
    <PreviewFeatureFlagsProvider draftFlags={draftFlags ?? defaultFlags}>
      <PreviewErrorBoundary featureKey={featureKey} context="route">
        <PreviewRouteShell
          embedded={embedded}
          feature={feature}
          routePath={routePreview.path}
          summary={routePreview.summary}
        >
          <RouteComponent />
        </PreviewRouteShell>
      </PreviewErrorBoundary>
    </PreviewFeatureFlagsProvider>
  );
}
