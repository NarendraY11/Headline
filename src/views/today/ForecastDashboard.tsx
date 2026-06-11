// M11B: ForecastDashboard — full predictive forecast section
// Composed of: ForecastSummaryCard, ReadinessTimelineChart, SuccessProbabilityTimeline,
// StudyHourPredictionCard, WeakSubjectForecastCard, MasteryTrendProjectionChart

import type { ForecastEngineResult } from "../../lib/forecastEngine";
import type { PredictiveIntelligenceResult } from "../../lib/predictiveIntelligence";
import { ForecastSummaryCard } from "./ForecastSummaryCard";
import { ReadinessTimelineChart } from "./ReadinessTimelineChart";
import { SuccessProbabilityTimeline } from "./SuccessProbabilityTimeline";
import { StudyHourPredictionCard } from "./StudyHourPredictionCard";
import { WeakSubjectForecastCard } from "./WeakSubjectForecastCard";
import { MasteryTrendProjectionChart } from "./MasteryTrendProjectionChart";

interface Props {
  forecast: ForecastEngineResult | null;
  predictive: PredictiveIntelligenceResult | null;
  subjectTitles: Record<string, string>;
  currentScore: number;
  loading: boolean;
}

function LoadingShell() {
  return (
    <div className="space-y-3">
      <div className="h-[220px] bg-bg-2 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="h-[220px] bg-bg-2 rounded-2xl animate-pulse" />
        <div className="h-[220px] bg-bg-2 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

export function ForecastDashboard({ forecast, predictive, subjectTitles, currentScore, loading }: Props) {
  if (loading) return <LoadingShell />;
  if (!forecast || !predictive) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-6 text-center">
        <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">
          Complete more quiz sessions to generate forecasts
        </p>
        <p className="font-sans text-xs text-muted mt-1">Forecasting requires mastery data from at least a few subjects.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Summary hero */}
      <ForecastSummaryCard
        forecast={forecast}
        predictive={predictive}
        loading={loading}
      />

      {/* Row 2: Readiness timeline + Success probability */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReadinessTimelineChart
          timeline={forecast.readinessTimeline}
          currentScore={currentScore}
          loading={loading}
        />
        <SuccessProbabilityTimeline
          timeline={forecast.successProbabilityTimeline}
          loading={loading}
        />
      </div>

      {/* Row 3: Study hours + Mastery trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StudyHourPredictionCard
          prediction={forecast.studyHourPrediction}
          subjectTitles={subjectTitles}
          loading={loading}
        />
        <MasteryTrendProjectionChart
          projection={forecast.masteryTrendProjection}
          loading={loading}
        />
      </div>

      {/* Row 4: Weak subject forecast (full width) */}
      {forecast.weakSubjectForecast.length > 0 && (
        <WeakSubjectForecastCard
          forecasts={forecast.weakSubjectForecast}
          subjectTitles={subjectTitles}
          loading={loading}
        />
      )}
    </div>
  );
}
