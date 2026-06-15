import { useMemo, type ReactNode } from "react";
import { FeatureFlagsContext, defaultFlags, type Flags } from "../hooks/useFeatureFlags";
import { usePreviewRenderDiagnostics } from "./previewDiagnostics";

interface PreviewFeatureFlagsProviderProps {
  children: ReactNode;
  draftFlags: Partial<Flags>;
}

export function PreviewFeatureFlagsProvider({
  children,
  draftFlags,
}: PreviewFeatureFlagsProviderProps) {
  usePreviewRenderDiagnostics("PreviewFeatureFlagsProvider");
  const mergedFlags = useMemo(
    () => ({ ...defaultFlags, ...draftFlags }),
    [draftFlags]
  );

  const value = useMemo(
    () => ({
      flags: mergedFlags,
      loading: false,
    }),
    [mergedFlags]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}
