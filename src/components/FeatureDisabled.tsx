import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

interface Props {
  title: string;
  featureKey: string;
}

export function FeatureDisabled({ title, featureKey }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[240px] text-center px-6">
      <Lock size={28} className="text-muted-2 mb-4" />
      <h2 className="font-serif text-xl text-ink mb-1">{title}</h2>
      <p className="text-sm text-muted mb-3">This feature exists but is currently disabled.</p>
      <p className="text-xs text-muted-2">
        Enable{" "}
        <code className="font-mono bg-bg-2 px-1 py-0.5 rounded text-ink">{featureKey}</code>
        {" "}from{" "}
        <Link to="/admin/features" className="underline hover:text-ink transition-colors">
          Feature Control
        </Link>
        .
      </p>
    </div>
  );
}
