-- M10A: Operations Console — add pricing, site_content, ai_settings columns
-- to app_settings. Existing flags data is preserved. All three default to
-- empty JSONB objects so existing code that selects them gets {} not null.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS pricing      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS site_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_settings  jsonb NOT NULL DEFAULT '{}'::jsonb;
