-- M10C follow-up: server-side 7-day active user aggregation.
-- Replaces the 50K-row client-side fetch. Admin-only via is_admin() guard.

CREATE OR REPLACE FUNCTION public.count_seven_day_active_users(
  window_start timestamptz
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COUNT(*)::integer
    FROM (
      SELECT user_id
      FROM public.events
      WHERE user_id IS NOT NULL
        AND created_at >= window_start
      GROUP BY user_id
      HAVING COUNT(DISTINCT created_at::date) >= 7
    ) sub
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.count_seven_day_active_users(timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.count_seven_day_active_users(timestamptz) TO authenticated, service_role;
