create table public.qe_writing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  progress jsonb not null default '{"first":{},"reviews":{},"answered":0,"correct":0,"xp":0}',
  workspace jsonb,
  updated_at timestamptz not null default now()
);
create table public.qe_writing_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  data jsonb not null,
  received_at timestamptz not null default now(),
  primary key(user_id,event_id)
);
create index qe_writing_history on public.qe_writing_events(user_id,received_at desc,event_id);
create table public.qe_writing_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  revision bigint not null default 0,
  value jsonb,
  summary jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,id)
);
create table public.qe_writing_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  document_id uuid not null,
  primary key(user_id,request_id)
);
create table public.qe_writing_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  content_id text not null,
  edition integer not null,
  message text not null check(length(message) between 5 and 1500),
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now(),
  primary key(user_id,id)
);
alter table public.qe_writing_accounts enable row level security;
alter table public.qe_writing_events enable row level security;
alter table public.qe_writing_documents enable row level security;
alter table public.qe_writing_requests enable row level security;
alter table public.qe_writing_reports enable row level security;
revoke all on public.qe_writing_accounts,public.qe_writing_events,public.qe_writing_documents,public.qe_writing_requests,public.qe_writing_reports from anon,authenticated;
grant all on public.qe_writing_accounts,public.qe_writing_events,public.qe_writing_documents,public.qe_writing_requests,public.qe_writing_reports to service_role;
alter table public.qe_study_stats add column writing_answers bigint not null default 0 check(writing_answers>=0);

create function public.qe_writing_commit(p_user_id uuid,p_revision bigint,p_progress jsonb,p_events jsonb,p_workspace jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare previous public.qe_writing_accounts; earned bigint; answered bigint; e jsonb;
begin
  insert into public.qe_writing_accounts(user_id) values(p_user_id) on conflict do nothing;
  select * into previous from public.qe_writing_accounts where user_id=p_user_id for update;
  if previous.revision<>p_revision then return false; end if;
  earned:=(p_progress->>'xp')::bigint-(previous.progress->>'xp')::bigint;
  answered:=(p_progress->>'answered')::bigint-(previous.progress->>'answered')::bigint;
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>100 or earned<0 or earned>jsonb_array_length(p_events)*10 or answered<0 or answered>jsonb_array_length(p_events) then
    raise exception 'INVALID_WRITING_COMMIT' using errcode='22023';
  end if;
  for e in select value from jsonb_array_elements(p_events) loop
    insert into public.qe_writing_events(user_id,event_id,data) values(p_user_id,(e->>'id')::uuid,e);
  end loop;
  update public.qe_writing_accounts set progress=p_progress,workspace=p_workspace,revision=revision+1,updated_at=now() where user_id=p_user_id;
  insert into public.qe_study_stats(user_id,writing_answers,total_xp) values(p_user_id,answered,earned)
    on conflict(user_id) do update set writing_answers=public.qe_study_stats.writing_answers+excluded.writing_answers,total_xp=public.qe_study_stats.total_xp+excluded.total_xp;
  return true;
end;
$$;

create function public.qe_writing_save_document(p_user_id uuid,p_id uuid,p_revision bigint,p_request_id uuid,p_value jsonb,p_summary jsonb,p_delete boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare previous public.qe_writing_documents;
begin
  insert into public.qe_writing_documents(user_id,id) values(p_user_id,p_id) on conflict do nothing;
  select * into previous from public.qe_writing_documents where user_id=p_user_id and id=p_id for update;
  if exists(select 1 from public.qe_writing_requests where user_id=p_user_id and request_id=p_request_id and document_id=p_id) then return true; end if;
  if previous.revision<>p_revision or previous.deleted then return false; end if;
  insert into public.qe_writing_requests(user_id,request_id,document_id) values(p_user_id,p_request_id,p_id);
  update public.qe_writing_documents set revision=revision+1,value=case when p_delete then null else p_value end,summary=case when p_delete then null else p_summary end,deleted=p_delete,updated_at=now() where user_id=p_user_id and id=p_id;
  return true;
end;
$$;
revoke all on function public.qe_writing_commit(uuid,bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.qe_writing_save_document(uuid,uuid,bigint,uuid,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.qe_writing_commit(uuid,bigint,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.qe_writing_save_document(uuid,uuid,bigint,uuid,jsonb,jsonb,boolean) to service_role;
