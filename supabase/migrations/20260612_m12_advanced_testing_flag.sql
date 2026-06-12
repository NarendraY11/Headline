-- M12: Advanced Testing System — add feature flag
-- OFF by default; enable via Admin → Feature Control

UPDATE app_settings
SET flags = flags || '{"advancedTesting": false}'::jsonb
WHERE id = 1;
