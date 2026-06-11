// M11: Pass Probability Card

import type { PassProbabilityResult } from "../../lib/predictiveIntelligence";

const BAND_CONFIG = {
  strong:   { color: "#16a34a", bg: "bg-mint/10",    border: "border-mint/20",   label: "Strong" },
  moderate: { color: "#e5a93c", bg: "bg-amber/10",   border: "border-amber/20",  label: "Moderate" },
  marginal: { color: "#f97316", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Marginal" },
  at_risk:  { color: "#e33a2e", bg: "bg-signal/10",  border: "border-signal/20", label: "At Risk" },
};

interface Props {
  result: PassProbabilityResult;
  loading?: boolean;
}

const RADIUS = 38;
const STROKE = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_FRACTION = 0.75;
const ARC_LENGTH = CIRCUMFERENCE * ARC_FRACTION;

export function PassProbabilityCard({ result, loading }: Props) {
  const config = BAND_CONFIG[result.band];
  const filled = ARC_LENGTH * (result.probability / 100);
  const offset = ARC_LENGTH - filled;

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § PASS PROBABILITY
        </span>
        <span className={`ml-auto font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded ${config.bg} ${config.border} border`}
          style={{ color: config.color }}>
          {config.label}
        </span>
      </div>

      <div className="flex items-center gap-5">
        {/* Mini arc gauge */}
        <div className="relative flex-shrink-0 w-[90px] h-[90px]">
          <svg viewBox="0 0 90 90" className="w-full h-full" aria-label={`Pass probability ${result.probability}%`} role="img">
            <circle cx="45" cy="45" r={RADIUS} fill="none" stroke="currentColor"
              strokeWidth={STROKE} strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
              strokeDashoffset={0} strokeLinecap="round"
              transform="rotate(135 45 45)" className="text-bg-2" />
            {!loading && (
              <circle cx="45" cy="45" r={RADIUS} fill="none"
                stroke={config.color} strokeWidth={STROKE}
                strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
                strokeDashoffset={offset} strokeLinecap="round"
                transform="rotate(135 45 45)"
                style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
            )}
            <text x="45" y="42" textAnchor="middle" dominantBaseline="middle"
              style={{ fontFamily: "var(--font-serif, Georgia, serif)", fill: loading ? "#888" : config.color }}
              fontSize="18" fontWeight="600">
              {loading ? "--" : result.probability}
            </text>
            <text x="45" y="54" textAnchor="middle" dominantBaseline="middle"
              style={{ fontFamily: "var(--font-mono, monospace)", fill: "#9ca3af" }}
              fontSize="6" letterSpacing="0.5">
              {loading ? "" : "PASS%"}
            </text>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-serif text-[22px] text-ink leading-none mb-1" style={{ color: config.color }}>
            {loading ? "—" : `${result.probability}%`}
          </p>
          <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide mb-3">
            estimated pass chance
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] text-muted-2 uppercase tracking-wide w-20 flex-shrink-0">Trend factor</span>
              <span className={`font-mono text-[10px] font-semibold ${
                result.trendMultiplier > 1 ? "text-mint" :
                result.trendMultiplier < 0.95 ? "text-signal" : "text-muted"
              }`}>
                {result.trendMultiplier > 1 ? "↑" : result.trendMultiplier < 1 ? "↓" : "→"}
                {" "}{((result.trendMultiplier - 1) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
