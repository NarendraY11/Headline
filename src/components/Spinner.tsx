interface SpinnerProps {
  /** Diameter in px. */
  size?: number;
  /** Optional caption rendered under the spinner. */
  label?: string;
  /** When true, fills its parent and centers (use for full-panel loading). */
  center?: boolean;
  className?: string;
}

// Shared loading spinner so every view uses the same affordance instead of a
// mix of plain "Loading..." text and ad-hoc inline spinners.
export function Spinner({ size = 32, label, center = true, className = "" }: SpinnerProps) {
  const ring = (
    <div
      className="border-ink border-t-transparent rounded-full animate-spin"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 8)) }}
      role="status"
      aria-label={label || "Loading"}
    />
  );

  if (!center) return <span className={className}>{ring}</span>;

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      {ring}
      {label && <p className="mt-3 text-xs font-mono uppercase tracking-widest text-muted-2">{label}</p>}
    </div>
  );
}
