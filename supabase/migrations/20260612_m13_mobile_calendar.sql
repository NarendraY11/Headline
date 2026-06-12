-- M13: Mobile & Calendar — push_subscriptions table + feature flags

-- Push subscription store (VAPID Web Push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     text NOT NULL,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own subscriptions
CREATE POLICY push_subscriptions_select ON public.push_subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY push_subscriptions_insert ON public.push_subscriptions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY push_subscriptions_update ON public.push_subscriptions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY push_subscriptions_delete ON public.push_subscriptions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Performance index
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

-- M13 feature flags (all OFF by default)
UPDATE public.app_settings
SET flags = flags
  || '{"pwaEnhanced": false}'::jsonb
  || '{"offlineMissions": false}'::jsonb
  || '{"pushNotifications": false}'::jsonb
  || '{"calendarSync": true}'::jsonb
WHERE id = 1;
