import { memo } from "react";
import { EyeOff } from "lucide-react";
import type { FeatureDefinition } from "./featureRegistry";

interface FeaturePreviewUnavailableProps {
  feature?: FeatureDefinition | null;
  message?: string;
}

function FeaturePreviewUnavailableInner({
  feature,
  message = "Live preview infrastructure is ready, but this feature does not have a live preview yet.",
}: FeaturePreviewUnavailableProps) {
  return (
    <div className="h-full min-h-[220px] rounded-xl border border-dashed border-rule-strong bg-bg-2/60 p-6 flex flex-col items-center justify-center text-center">
      <EyeOff size={24} className="text-muted-2 mb-3" />
      <h3 className="font-serif text-base text-ink mb-1">
        {feature ? `${feature.title} Preview` : "Preview Unavailable"}
      </h3>
      <p className="font-sans text-xs text-muted-2 max-w-sm leading-relaxed">
        {message}
      </p>
    </div>
  );
}

export const FeaturePreviewUnavailable = memo(FeaturePreviewUnavailableInner);
