-- M11: Predictive Intelligence — add feature flag to app_settings
-- Flag OFF by default; enable via admin FeatureControl panel

UPDATE app_settings
SET flags = flags || '{"predictiveIntelligence": false}'::jsonb
WHERE id = 1;
