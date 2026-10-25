create table public.qe_reading_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  state jsonb not null default '{"concepts":{},"first":{},"xp":0,"answered":0,"correct":0}',
  session jsonb,
  preferences jsonb not null default '{"track":"functions","tutorial":true}',
  updated_at timestamptz not null default now()
);
create table public.qe_reading_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  data jsonb not null,
  received_at timestamptz not null default now(),
  primary key(user_id,event_id)
);
create index qe_reading_events_history on public.qe_reading_events(user_id,received_at desc,event_id);
alter table public.qe_reading_accounts enable row level security;
alter table public.qe_reading_events enable row level security;
revoke all on public.qe_reading_accounts,public.qe_reading_events from anon,authenticated;
grant all on public.qe_reading_accounts,public.qe_reading_events to service_role;
alter table public.qe_study_stats add column reading_answers bigint not null default 0 check(reading_answers>=0);

-- Only the authenticated application server grades events; the browser cannot invoke this commit.
create function public.qe_reading_commit(p_user_id uuid,p_revision bigint,p_state jsonb,p_events jsonb,p_session jsonb,p_preferences jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare previous public.qe_reading_accounts; earned bigint; answered bigint; e jsonb;
begin
  insert into public.qe_reading_accounts(user_id) values(p_user_id) on conflict do nothing;
  select * into previous from public.qe_reading_accounts where user_id=p_user_id for update;
  if previous.revision<>p_revision then return false; end if;
  earned:=(p_state->>'xp')::bigint-(previous.state->>'xp')::bigint;
  answered:=(p_state->>'answered')::bigint-(previous.state->>'answered')::bigint;
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>100
    or earned<0 or earned>jsonb_array_length(p_events)*10 or answered<0 or answered>jsonb_array_length(p_events)
    then raise exception 'INVALID_READING_COMMIT' using errcode='22023'; end if;
  for e in select value from jsonb_array_elements(p_events) loop
    insert into public.qe_reading_events(user_id,event_id,data) values(p_user_id,(e->>'id')::uuid,e);
  end loop;
  update public.qe_reading_accounts set state=p_state,session=p_session,preferences=p_preferences,
    revision=revision+1,updated_at=now() where user_id=p_user_id;
  insert into public.qe_study_stats(user_id,reading_answers,total_xp) values(p_user_id,answered,earned)
    on conflict(user_id) do update set reading_answers=public.qe_study_stats.reading_answers+excluded.reading_answers,
      total_xp=public.qe_study_stats.total_xp+excluded.total_xp;
  return true;
end;
$$;
revoke all on function public.qe_reading_commit(uuid,bigint,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.qe_reading_commit(uuid,bigint,jsonb,jsonb,jsonb,jsonb) to service_role;
