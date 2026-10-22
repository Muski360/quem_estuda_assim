create table public.qe_study_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scroll_questions bigint not null default 0 check (scroll_questions >= 0),
  calculator_rounds bigint not null default 0 check (calculator_rounds >= 0),
  total_xp bigint not null default 0 check (total_xp >= 0)
);
create table public.qe_study_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  module text not null check (module in ('scroll', 'calculator')),
  xp integer not null check (xp >= 0 and xp <= case when module = 'scroll' then 45 else 60 end),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.qe_study_stats enable row level security;
alter table public.qe_study_events enable row level security;
revoke all on public.qe_study_stats, public.qe_study_events from anon, authenticated;
grant select on public.qe_study_stats to authenticated;
grant all on public.qe_study_stats, public.qe_study_events to service_role;
create policy "Read own study totals" on public.qe_study_stats
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.qe_record_study_activity(p_event_id uuid, p_module text, p_xp integer)
returns setof public.qe_study_stats
language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  inserted integer;
begin
  if account_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_event_id is null or p_module is null or p_module not in ('scroll', 'calculator')
    or p_xp is null or p_xp < 0 or p_xp > (case when p_module = 'scroll' then 45 else 60 end) then
    raise exception 'INVALID_ACTIVITY' using errcode = '22023';
  end if;
  insert into public.qe_study_events(user_id, event_id, module, xp)
    values (account_id, p_event_id, p_module, p_xp) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    insert into public.qe_study_stats(user_id, scroll_questions, calculator_rounds, total_xp)
      values (account_id, case when p_module = 'scroll' then 1 else 0 end, case when p_module = 'calculator' then 1 else 0 end, p_xp)
      on conflict (user_id) do update set
        scroll_questions = public.qe_study_stats.scroll_questions + excluded.scroll_questions,
        calculator_rounds = public.qe_study_stats.calculator_rounds + excluded.calculator_rounds,
        total_xp = public.qe_study_stats.total_xp + excluded.total_xp;
  end if;
  return query select * from public.qe_study_stats where user_id = account_id;
end;
$$;
revoke all on function public.qe_record_study_activity(uuid, text, integer) from public, anon;
grant execute on function public.qe_record_study_activity(uuid, text, integer) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('qe-avatars', 'qe-avatars', true, 2097152, array['image/webp']) on conflict (id) do nothing;
create policy "Upload own profile photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'qe-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read own profile photo objects" on storage.objects for select to authenticated
  using (bucket_id = 'qe-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own profile photo" on storage.objects for delete to authenticated
  using (bucket_id = 'qe-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
