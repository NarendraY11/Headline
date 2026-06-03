-- Web Push subscriptions (PWA Tier 3).
-- One row per browser/device push endpoint a user has opted into.
-- The send-push edge function reads this table with the service role (bypasses
-- RLS); clients may only see and manage their own rows.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users manage only their own subscriptions.
drop policy if exists "own push subscriptions: select" on public.push_subscriptions;
create policy "own push subscriptions: select"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "own push subscriptions: insert" on public.push_subscriptions;
create policy "own push subscriptions: insert"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "own push subscriptions: update" on public.push_subscriptions;
create policy "own push subscriptions: update"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own push subscriptions: delete" on public.push_subscriptions;
create policy "own push subscriptions: delete"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
