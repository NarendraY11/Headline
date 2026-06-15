import { useParams } from "react-router-dom";
import { PreviewFeatureFlagsProvider } from "../../preview/PreviewFeatureFlagsProvider";
import { usePreviewDraftFlags } from "../../preview/usePreviewMode";
import { defaultFlags, type FlagKeys } from "../../hooks/useFeatureFlags";
import { FeaturePreviewUnavailable } from "./FeaturePreviewUnavailable";
import { PreviewRouteShell } from "./PreviewRouteShell";
import { featureRegistry } from "./featureRegistry";
import { previewRoutes } from "./previewRoutes";

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
  const featureKey = (featureKeyProp ?? featureKeyParam) as FlagKeys | undefined;

  if (!featureKey || !(featureKey in featureRegistry)) {
    return (
      <FeaturePreviewUnavailable message="This preview route does not map to a known feature flag." />
    );
  }

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
      <PreviewRouteShell
        embedded={embedded}
        feature={feature}
        routePath={routePreview.path}
        summary={routePreview.summary}
      >
        <RouteComponent />
      </PreviewRouteShell>
    </PreviewFeatureFlagsProvider>
  );
}
