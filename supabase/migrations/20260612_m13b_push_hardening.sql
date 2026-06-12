-- M13B: Push notification hardening
-- 1. Performance index on updated_at for cleanup queries
-- 2. push_subscription_cleanup() function — removes subscriptions inactive >90 days
-- 3. Service-role-only delete policy (edge function uses service role to prune gone endpoints)

-- Index for stale-subscription sweeps
CREATE INDEX IF NOT EXISTS push_subscriptions_updated_at_idx
  ON public.push_subscriptions (updated_at);

-- Cleanup function (safe to call from pg_cron or admin)
CREATE OR REPLACE FUNCTION public.cleanup_stale_push_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE updated_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Only admins and service role may call it
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_push_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_push_subscriptions() TO service_role;
