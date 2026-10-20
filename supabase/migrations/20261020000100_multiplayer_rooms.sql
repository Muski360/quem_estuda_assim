create table public.qe_rooms (
  code text primary key check (code ~ '^[A-F0-9]{6}$'),
  state jsonb not null,
  version bigint not null default 1,
  expires_at timestamptz not null
);

create index qe_rooms_expires_at_idx on public.qe_rooms (expires_at);
alter table public.qe_rooms enable row level security;
revoke all on public.qe_rooms from anon, authenticated;
grant select, insert, update, delete on public.qe_rooms to service_role;

-- Only the server can read answers/tokens or commit a new room version.
create function public.qe_commit_room(
  p_code text,
  p_version bigint,
  p_state jsonb,
  p_notify boolean default true
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
  channel_id text;
begin
  if p_version = 0 then
    perform pg_catalog.pg_advisory_xact_lock(817346201);
    delete from public.qe_rooms where expires_at <= now();
    if (select count(*) from public.qe_rooms) >= 200 then
      raise exception 'ROOM_LIMIT';
    end if;
    insert into public.qe_rooms (code, state, version, expires_at)
      values (p_code, p_state, 1, to_timestamp((p_state->>'expiresAt')::double precision / 1000))
      on conflict (code) do nothing;
    get diagnostics changed = row_count;
    channel_id := p_state->>'channelId';
  elsif p_state is null then
    delete from public.qe_rooms where code = p_code and version = p_version
      returning state->>'channelId' into channel_id;
    get diagnostics changed = row_count;
  else
    update public.qe_rooms
      set state = p_state, version = version + 1,
        expires_at = to_timestamp((p_state->>'expiresAt')::double precision / 1000)
      where code = p_code and version = p_version;
    get diagnostics changed = row_count;
    channel_id := p_state->>'channelId';
  end if;

  if changed = 1 and p_notify and channel_id is not null then
    -- The unguessable topic is shared only with admitted room members.
    -- Events contain no game data: clients refetch an authenticated snapshot.
    perform realtime.send(jsonb_build_object('version', p_version + 1), 'room_changed', 'qe:' || channel_id, false);
  end if;
  return changed = 1;
end;
$$;

revoke all on function public.qe_commit_room(text, bigint, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.qe_commit_room(text, bigint, jsonb, boolean) to service_role;
