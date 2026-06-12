-- Block unauthenticated (anon) inserts on events.
-- Old policy allowed user_id IS NULL when auth.uid() IS NULL — spam vector
-- (anon `events` INSERT uncapped, flagged in launch audit 2026-06-07).

DROP POLICY IF EXISTS events_insert ON public.events;

CREATE POLICY events_insert ON public.events
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );
