import React, { type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { logPreviewError } from "./previewDiagnostics";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  featureKey?: string;
  context?: "panel" | "route" | "component";
  fallback?: ReactNode;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PreviewErrorBoundary extends React.Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  public state: PreviewErrorBoundaryState = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    const { featureKey, context = "panel" } = this.props;
    logPreviewError(error, { featureKey, context, componentStack: info.componentStack ?? undefined });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const { error } = this.state;
    const { featureKey, context = "panel" } = this.props;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="h-full min-h-[220px] rounded-xl border border-rose-200 bg-rose-50/50 p-6 flex flex-col items-center justify-center text-center"
      >
        <AlertCircle size={24} className="text-rose-600 mb-3" aria-hidden="true" />
        <h3 className="font-serif text-base text-ink mb-1">Preview crashed</h3>
        <p className="font-sans text-xs text-muted-2 max-w-sm leading-relaxed mb-4">
          {context === "route" ? "Route preview" : context === "component" ? "Component preview" : "Preview panel"} encountered an error
          {featureKey ? ` for "${featureKey}"` : ""}.
        </p>
        {import.meta.env.DEV && error && (
          <pre className="text-[10px] font-mono text-rose-700 bg-rose-100 rounded-lg px-3 py-2 max-w-sm overflow-auto text-left mb-4 whitespace-pre-wrap break-all max-h-28">
            {error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={this.handleReset}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-2 hover:text-ink transition-colors"
          aria-label="Retry loading preview"
        >
          <RefreshCw size={11} aria-hidden="true" /> Retry preview
        </button>
      </div>
    );
  }
}
