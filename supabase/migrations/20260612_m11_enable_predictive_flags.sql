-- M11/M11B: enable predictiveIntelligence + dependent forecast flags.
-- masterySnapshots + examReadinessDashboard already ON in prod.
-- masteryAnalytics feeds MasteryTrendProjectionChart; examReadinessEta feeds
-- velocity/ETA used by SuccessForecastCard + ForecastSummaryCard.

UPDATE app_settings
SET flags = flags
  || '{"predictiveIntelligence": true}'::jsonb
  || '{"masteryAnalytics": true}'::jsonb
  || '{"examReadinessEta": true}'::jsonb
WHERE id = 1;
