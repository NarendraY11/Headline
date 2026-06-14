-- M13C: push_delivery_log — per-attempt analytics for send-push edge function

CREATE TABLE IF NOT EXISTS public.push_delivery_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id   text,                              -- opaque caller-supplied ID
  notification_type text        NOT NULL DEFAULT 'broadcast',
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint_hash     text        NOT NULL,              -- SHA-256 of endpoint (privacy-safe)
  success           boolean     NOT NULL,
  status_code       integer,
  error_message     text,
  ttl               integer     NOT NULL DEFAULT 86400,
  sent_at           timestamptz NOT NULL DEFAULT now()
);

-- Admins can read delivery analytics; users cannot see their own send log
ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_delivery_log_admin_select ON public.push_delivery_log
  FOR SELECT USING (public.is_admin());

-- Service role (edge function) inserts; no client writes
CREATE POLICY push_delivery_log_service_insert ON public.push_delivery_log
  FOR INSERT WITH CHECK (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS push_delivery_log_sent_at_idx
  ON public.push_delivery_log (sent_at DESC);

CREATE INDEX IF NOT EXISTS push_delivery_log_user_id_idx
  ON public.push_delivery_log (user_id);

CREATE INDEX IF NOT EXISTS push_delivery_log_notification_id_idx
  ON public.push_delivery_log (notification_id)
  WHERE notification_id IS NOT NULL;

-- Convenience analytics view for admin panel
CREATE OR REPLACE VIEW public.push_delivery_stats AS
SELECT
  date_trunc('hour', sent_at)      AS hour,
  notification_type,
  count(*)                          AS total_attempts,
  count(*) FILTER (WHERE success)   AS delivered,
  count(*) FILTER (WHERE NOT success) AS failed,
  round(
    count(*) FILTER (WHERE success)::numeric /
    nullif(count(*), 0) * 100, 1
  )                                 AS delivery_rate_pct
FROM public.push_delivery_log
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
