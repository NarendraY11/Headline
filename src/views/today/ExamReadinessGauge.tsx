// M8B: Exam Readiness Gauge
//
// Radial arc (SVG strokeDasharray) showing composite ExamReadinessScore.
// Four component bars below the arc: mastery / coverage / consistency / recency.
// Lazy-loaded; gated behind examReadinessDashboard flag in parent.

import { BAND_COLOR, BAND_LABEL, type ExamReadinessResult } from "../../lib/examReadiness";

interface Props extends ExamReadinessResult {
  loading?: boolean;
}

const RADIUS = 54;
const STROKE = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Show 270° of arc (gap at bottom). 270/360 = 0.75
const ARC_FRACTION = 0.75;
const ARC_LENGTH = CIRCUMFERENCE * ARC_FRACTION;

const COMPONENT_META = [
  { key: "mastery",     label: "Mastery",     weight: "45%" },
  { key: "coverage",    label: "Coverage",    weight: "25%" },
  { key: "consistency", label: "Consistency", weight: "20%" },
  { key: "recency",     label: "Recency",     weight: "10%" },
] as const;

function ComponentBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: string;
}) {
  const pct = Math.round(value * 100);
  const barColor = pct >= 80 ? "bg-mint" : pct >= 50 ? "bg-amber" : "bg-signal/70";
  return (
    <div className="flex items-center gap-2">
      <div className="w-[72px] flex-shrink-0">
        <p className="font-mono text-[8px] uppercase tracking-wide text-muted-2 leading-none">
          {label}
        </p>
        <p className="font-mono text-[7px] text-muted-2 opacity-60">{weight}</p>
      </div>
      <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[9px] text-ink w-7 text-right flex-shrink-0">{pct}%</span>
    </div>
  );
}

export function ExamReadinessGauge({ score, band, components, loading }: Props) {
  const color = BAND_COLOR[band];
  const label = BAND_LABEL[band];

  // dashoffset: full gap = ARC_LENGTH, filled = score% of ARC_LENGTH
  const filled = ARC_LENGTH * (score / 100);
  const offset = ARC_LENGTH - filled;

  // Rotation so arc starts at bottom-left (225°) and sweeps clockwise
  const startAngle = 135; // degrees; 0° = right, SVG rotates clockwise

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § EXAM READINESS
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Arc gauge */}
        <div className="relative flex-shrink-0 w-[132px] h-[132px]">
          <svg
            viewBox="0 0 132 132"
            className="w-full h-full"
            aria-label={`Exam readiness ${score}% — ${label}`}
            role="img"
          >
            {/* Track */}
            <circle
              cx="66"
              cy="66"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              transform={`rotate(${startAngle} 66 66)`}
              className="text-bg-2"
            />
            {/* Fill */}
            {!loading && (
              <circle
                cx="66"
                cy="66"
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(${startAngle} 66 66)`}
                style={{ transition: "stroke-dashoffset 0.8s ease-out, stroke 0.4s" }}
              />
            )}
            {/* Score */}
            <text
              x="66"
              y="60"
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-serif"
              style={{ fontFamily: "var(--font-serif, Georgia, serif)", fill: loading ? "#888" : color }}
              fontSize="26"
              fontWeight="600"
            >
              {loading ? "--" : score}
            </text>
            <text
              x="66"
              y="78"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: "var(--font-mono, monospace)", fill: "#9ca3af" }}
              fontSize="7"
              letterSpacing="1"
            >
              {loading ? "" : label.toUpperCase()}
            </text>
          </svg>
        </div>

        {/* Component bars */}
        <div className="flex-1 space-y-2.5 min-w-0">
          {COMPONENT_META.map(({ key, label: l, weight }) => (
            <ComponentBar
              key={key}
              label={l}
              value={loading ? 0 : components[key]}
              weight={weight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
