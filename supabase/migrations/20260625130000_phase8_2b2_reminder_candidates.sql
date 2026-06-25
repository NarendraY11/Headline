-- =====================================================================
-- Phase 8.2B.2 — batched reminder-signal source for push delivery.
--
-- get_reminder_candidates(): ONE row per push-subscribed user with the RAW
-- signals selectReminder() needs. NO priority logic here — the Edge Function
-- owns the decision (one brain). SECURITY DEFINER + service_role-only so it can
-- read across users; never exposed to anon/authenticated.
--
-- "today" is UTC (server-side push). Streak is returned as the distinct UTC
-- completion days array — the Edge Function runs the shared computeMissionStreak.
-- =====================================================================

create or replace function public.get_reminder_candidates()
returns table (
  user_id                uuid,
  notification_prefs     jsonb,
  mission_status         text,
  mission_started_at     text,
  mission_title          text,
  completed_today        boolean,
  completed_days         text[],
  xp_balance             bigint,
  due_count              bigint,
  next_exam              text,
  already_reminded_today boolean
)
language sql
security definer
set search_path = public
as $$
  with subscribers as (
    select distinct ps.user_id from public.push_subscriptions ps
  ),
  active_mission as (
    -- the single active system mission per user (pending/in_progress)
    select distinct on (sm.user_id)
      sm.user_id,
      sm.status,
      sm.payload->>'startedAt' as started_at,
      sm.payload->>'title'     as title
    from public.study_missions sm
    where sm.source = 'system'
      and sm.status in ('pending', 'in_progress')
    order by sm.user_id, sm.created_at desc
  ),
  completed as (
    select
      sm.user_id,
      array_agg(distinct to_char(sm.completed_at at time zone 'UTC', 'YYYY-MM-DD')) as days,
      bool_or((sm.completed_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date) as done_today
    from public.study_missions sm
    where sm.source = 'system'
      and sm.status = 'completed'
      and sm.completed_at is not null
    group by sm.user_id
  ),
  xp as (
    select e.user_id, coalesce(sum(e.amount), 0) as balance
    from public.xp_events e
    group by e.user_id
  ),
  due as (
    select qp.user_id, count(*) as cnt
    from public.question_progress qp
    where qp.next_review_at <= now()
    group by qp.user_id
  ),
  reminded as (
    -- cooldown source: a successful reminder-class push already sent today
    select distinct dl.user_id
    from public.push_delivery_log dl
    where dl.success = true
      and dl.notification_type in ('reminder', 'streak', 'exam')
      and (dl.sent_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date
  )
  select
    s.user_id,
    coalesce(p.notification_prefs, '{}'::jsonb)            as notification_prefs,
    am.status                                              as mission_status,
    am.started_at                                          as mission_started_at,
    am.title                                               as mission_title,
    coalesce(c.done_today, false)                          as completed_today,
    coalesce(c.days, array[]::text[])                      as completed_days,
    coalesce(x.balance, 0)                                 as xp_balance,
    coalesce(d.cnt, 0)                                     as due_count,
    p.next_exam                                            as next_exam,
    (r.user_id is not null)                                as already_reminded_today
  from subscribers s
  left join public.profiles p on p.id = s.user_id
  left join active_mission am  on am.user_id = s.user_id
  left join completed c        on c.user_id = s.user_id
  left join xp x               on x.user_id = s.user_id
  left join due d              on d.user_id = s.user_id
  left join reminded r         on r.user_id = s.user_id;
$$;

-- Service-role only. Cron/Edge Function call it with the service key; never anon.
revoke execute on function public.get_reminder_candidates() from anon, authenticated, public;
