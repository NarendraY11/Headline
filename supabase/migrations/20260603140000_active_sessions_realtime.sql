-- Enable Postgres Realtime for active_sessions so a device is signed out the
-- instant another device takes over the single session slot, instead of
-- waiting for the client's 30s poll. RLS (auth.uid() = user_id) still gates the
-- stream, so each client only receives changes to its own session row.
--
-- Idempotent: skip if the table is already in the supabase_realtime publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'active_sessions'
  ) then
    alter publication supabase_realtime add table public.active_sessions;
  end if;
end $$;

-- FULL replica identity so UPDATE change payloads carry the whole row and the
-- realtime RLS check can be evaluated against the record.
alter table public.active_sessions replica identity full;
