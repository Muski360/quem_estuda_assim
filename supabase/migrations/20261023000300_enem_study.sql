create table public.qe_enem_questions (
  id text primary key,
  year integer not null check (year between 2009 and 2023),
  number integer not null check (number between 1 and 180),
  area text not null check (area in ('mathematics','nature','humanities','languages')),
  language text check (language in ('ingles','espanhol')),
  context text not null, prompt text not null,
  alternatives jsonb not null check (jsonb_array_length(alternatives) = 5),
  correct_index integer not null check (correct_index between 0 and 4),
  source jsonb not null, source_commit text not null, checksum text not null,
  published boolean not null default false,
  unique(year, number, language)
);
create index qe_enem_available on public.qe_enem_questions(year,area,language) where published;
create table public.qe_scroll_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null
);
create table public.qe_scroll_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('feed','session','errors','favorites')),
  area text not null, year integer, language text not null,
  target integer check (target in (5,10,20)),
  timed boolean not null, duration integer not null check (duration between 60 and 1800),
  current_position integer not null default 1,
  completed integer not null default 0, answered integer not null default 0,
  correct integer not null default 0, xp integer not null default 0,
  streak integer not null default 0, active_ms bigint not null default 0,
  created_at timestamptz not null default now(), finished_at timestamptz
);
create index qe_scroll_sessions_user on public.qe_scroll_sessions(user_id,created_at desc);
create table public.qe_scroll_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.qe_scroll_sessions(id) on delete cascade,
  question_id text not null references public.qe_enem_questions(id),
  position integer not null,
  status text not null default 'pending' check (status in ('pending','answered','skipped','expired','superseded')),
  selected integer check (selected between 0 and 4), correct boolean,
  xp integer not null default 0 check (xp in (0,10,15)),
  active_ms integer not null default 0 check (active_ms between 0 and 7200000),
  offered_at timestamptz, deadline timestamptz, paused_at timestamptz, answered_at timestamptz,
  unique(session_id, position), unique(session_id, question_id)
);
create table public.qe_scroll_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.qe_enem_questions(id),
  first_choice integer check (first_choice between 0 and 4), first_correct boolean,
  first_answered_at timestamptz, last_choice integer check (last_choice between 0 and 4), last_correct boolean,
  attempts integer not null default 0, favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id, question_id)
);
create index qe_scroll_progress_errors on public.qe_scroll_progress(user_id) where last_correct = false;
create index qe_scroll_progress_favorites on public.qe_scroll_progress(user_id) where favorite;

alter table public.qe_enem_questions enable row level security;
alter table public.qe_scroll_settings enable row level security;
alter table public.qe_scroll_sessions enable row level security;
alter table public.qe_scroll_items enable row level security;
alter table public.qe_scroll_progress enable row level security;
revoke all on public.qe_enem_questions, public.qe_scroll_settings, public.qe_scroll_sessions, public.qe_scroll_items, public.qe_scroll_progress from public, anon, authenticated;
grant all on public.qe_enem_questions, public.qe_scroll_settings, public.qe_scroll_sessions, public.qe_scroll_items, public.qe_scroll_progress to service_role;

create function public.qe_scroll_question(q public.qe_enem_questions) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id',q.id,'year',q.year,'number',q.number,'area',q.area,'language',q.language,
    'context',q.context,'prompt',q.prompt,'alternatives',q.alternatives,'source',q.source);
$$;
revoke all on function public.qe_scroll_question(public.qe_enem_questions) from public,anon,authenticated;

create function public.qe_valid_scroll_settings(s jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(s) = 'object' and s ?& array['area','year','language','mode','target','timed','minutes','goal']
    and s->>'area' in ('all','mathematics','nature','humanities','languages')
    and (s->'year' = 'null'::jsonb or (jsonb_typeof(s->'year')='number' and (s->>'year')::integer between 2009 and 2023))
    and s->>'language' in ('ingles','espanhol') and s->>'mode' in ('feed','session','errors','favorites')
    and s->'target' in ('5'::jsonb,'10'::jsonb,'20'::jsonb) and s->'goal' in ('5'::jsonb,'10'::jsonb,'20'::jsonb)
    and jsonb_typeof(s->'timed')='boolean' and jsonb_typeof(s->'minutes')='number'
    and (s->>'minutes')::integer between 1 and 30, false);
$$;
revoke all on function public.qe_valid_scroll_settings(jsonb) from public,anon,authenticated;

create function public.qe_scroll_stats() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  settings jsonb;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  expected_day date := today;
  study_day date;
  streak integer := 0;
  result jsonb;
begin
  if account_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select s.settings into settings from public.qe_scroll_settings s where s.user_id=account_id;
  settings := coalesce(settings,'{"area":"all","year":null,"language":"ingles","mode":"feed","target":10,"timed":false,"minutes":3,"goal":5}'::jsonb);
  for study_day in
    select distinct (i.answered_at at time zone 'America/Sao_Paulo')::date
    from public.qe_scroll_items i join public.qe_scroll_sessions s on s.id=i.session_id
    where s.user_id=account_id and i.status='answered' order by 1 desc
  loop
    if streak=0 and study_day=today-1 then expected_day:=today-1; end if;
    exit when study_day<>expected_day;
    streak:=streak+1; expected_day:=expected_day-1;
  end loop;
  select jsonb_build_object('answered',count(*) filter(where p.first_answered_at is not null),
    'correct',count(*) filter(where p.first_correct),'settings',settings,'streak',streak,
    'totalXp',coalesce((select total_xp from public.qe_study_stats where user_id=account_id),0))
  into result from public.qe_scroll_progress p where p.user_id=account_id;
  select result || jsonb_build_object('activeMs',coalesce(sum(i.active_ms),0),'xp',coalesce(sum(i.xp),0),
    'reviews',count(*) filter(where i.status='answered')-(result->>'answered')::bigint,
    'reviewCorrect',count(*) filter(where i.status='answered' and i.correct)-(result->>'correct')::bigint,
    'today',count(distinct i.question_id) filter(where i.status='answered' and (i.answered_at at time zone 'America/Sao_Paulo')::date=today))
  into result from public.qe_scroll_items i join public.qe_scroll_sessions s on s.id=i.session_id where s.user_id=account_id;
  result:=result || jsonb_build_object('years',coalesce((select jsonb_agg(year order by year desc) from (select distinct year from public.qe_enem_questions where published) y),'[]'::jsonb));
  result:=result || jsonb_build_object('areas',coalesce((select jsonb_agg(row_to_json(a)) from (
    select q.area, count(*) as answered,count(*) filter(where p.first_correct) as correct
    from public.qe_scroll_progress p join public.qe_enem_questions q on q.id=p.question_id
    where p.user_id=account_id and p.first_answered_at is not null group by q.area
  ) a),'[]'::jsonb));
  result:=result || jsonb_build_object('daily',coalesce((select jsonb_agg(row_to_json(d) order by d.day) from (
    select to_char(day,'YYYY-MM-DD') as day,count(distinct i.question_id) filter(where i.status='answered') as answered,
      count(distinct i.question_id) filter(where i.status='answered' and i.correct) as correct,coalesce(sum(i.active_ms),0) as "activeMs"
    from generate_series(today-27,today,'1 day'::interval) day
    left join (public.qe_scroll_items i join public.qe_scroll_sessions s on s.id=i.session_id and s.user_id=account_id)
      on (i.answered_at at time zone 'America/Sao_Paulo')::date=day::date
    group by day
  ) d),'[]'::jsonb));
  return result;
end;
$$;
revoke all on function public.qe_scroll_stats() from public,anon;
grant execute on function public.qe_scroll_stats() to authenticated;

create function public.qe_scroll_command(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  s public.qe_scroll_sessions;
  i public.qe_scroll_items;
  q public.qe_enem_questions;
  prefs jsonb;
  choice integer;
  active_time integer;
  is_first boolean;
  is_correct boolean;
  earned integer := 0;
  result_status text;
  remaining integer;
  next_position integer;
  records jsonb;
  result jsonb;
  filter text;
  page_offset integer;
begin
  if account_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_data)<>'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text,0));
  if p_action='settings' or p_action='start' then
    prefs:=p_data->'settings';
    if not public.qe_valid_scroll_settings(prefs) then raise exception 'INVALID_SETTINGS' using errcode='22023'; end if;
    insert into public.qe_scroll_settings(user_id,settings) values(account_id,prefs)
      on conflict(user_id) do update set settings=excluded.settings;
    if p_action='settings' then return public.qe_scroll_stats(); end if;
    insert into public.qe_scroll_sessions(user_id,mode,area,year,language,target,timed,duration)
      values(account_id,prefs->>'mode',prefs->>'area',(prefs->>'year')::integer,prefs->>'language',
        case when prefs->>'mode'='session' then (prefs->>'target')::integer end,
        prefs->>'mode'='session' and (prefs->>'timed')::boolean,(prefs->>'minutes')::integer*60) returning * into s;
  elsif p_action='favorite' then
    if jsonb_typeof(p_data->'favorite')<>'boolean' then raise exception 'INVALID_FAVORITE' using errcode='22023'; end if;
    if not exists(select 1 from public.qe_enem_questions where id=p_data->>'questionId' and published) then raise exception 'QUESTION_NOT_FOUND' using errcode='P0002'; end if;
    insert into public.qe_scroll_progress(user_id,question_id,favorite) values(account_id,p_data->>'questionId',(p_data->>'favorite')::boolean)
      on conflict(user_id,question_id) do update set favorite=excluded.favorite,updated_at=now();
    return jsonb_build_object('favorite',(p_data->>'favorite')::boolean);
  elsif p_action='history' then
    filter:=coalesce(p_data->>'filter','all'); page_offset:=coalesce((p_data->>'offset')::integer,0);
    if filter not in ('all','errors','favorites') or page_offset<0 or page_offset>100000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
    select coalesce(jsonb_agg(row_to_json(h)),'[]'::jsonb) into records from (
      select public.qe_scroll_question(q) as question,p.favorite,p.first_choice as "firstChoice",p.first_correct as "firstCorrect",
        p.last_choice as "lastChoice",p.last_correct as "lastCorrect",case when p.first_answered_at is not null then q.correct_index end as "correctIndex",
        p.first_answered_at as "answeredAt",p.attempts
      from public.qe_scroll_progress p join public.qe_enem_questions q on q.id=p.question_id
      where p.user_id=account_id and q.published and case filter when 'errors' then p.last_correct=false when 'favorites' then p.favorite else p.first_answered_at is not null end
      order by p.updated_at desc,p.question_id limit 21 offset page_offset
    ) h;
    return jsonb_build_object('items',case when jsonb_array_length(records)>20 then records-20 else records end,
      'next',case when jsonb_array_length(records)>20 then page_offset+20 end);
  else
    select * into s from public.qe_scroll_sessions where id=(p_data->>'sessionId')::uuid and user_id=account_id for update;
    if s.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='P0002'; end if;
  end if;

  if p_action in ('answer','skip','pause') then
    select * into i from public.qe_scroll_items where session_id=s.id and id=(p_data->>'itemId')::uuid and position=s.current_position for update;
    if i.id is null then raise exception 'ITEM_NOT_FOUND' using errcode='P0002'; end if;
    if i.status='pending' and s.finished_at is null then
      if p_action='pause' then
        if jsonb_typeof(p_data->'paused')<>'boolean' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
        if (p_data->>'paused')::boolean and i.paused_at is null then
          update public.qe_scroll_items set paused_at=now() where id=i.id;
        elsif not (p_data->>'paused')::boolean and i.paused_at is not null then
          update public.qe_scroll_items set deadline=deadline+(now()-paused_at),paused_at=null where id=i.id;
        end if;
      else
        if i.paused_at is not null then raise exception 'SESSION_PAUSED' using errcode='22023'; end if;
        if jsonb_typeof(p_data->'activeMs')<>'number' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
        active_time:=greatest(0,least((p_data->>'activeMs')::integer,7200000,extract(epoch from now()-i.offered_at)::integer*1000));
        result_status:=case when i.deadline is not null and now()>=i.deadline then 'expired' when p_action='skip' then 'skipped' else 'answered' end;
        if result_status='answered' then
          if jsonb_typeof(p_data->'choice')<>'number' or (p_data->>'choice')::integer not between 0 and 4 then raise exception 'INVALID_CHOICE' using errcode='22023'; end if;
          choice:=(p_data->>'choice')::integer;
          select * into q from public.qe_enem_questions where id=i.question_id and published;
          if q.id is null then raise exception 'QUESTION_UNAVAILABLE' using errcode='P0002'; end if;
          is_correct:=choice=q.correct_index;
          select not exists(select 1 from public.qe_scroll_progress where user_id=account_id and question_id=i.question_id and first_answered_at is not null) into is_first;
          if is_first and is_correct and s.mode in ('feed','session') then earned:=case when s.streak>=2 then 15 else 10 end; end if;
          insert into public.qe_scroll_progress(user_id,question_id,first_choice,first_correct,first_answered_at,last_choice,last_correct,attempts)
            values(account_id,i.question_id,choice,is_correct,now(),choice,is_correct,1)
            on conflict(user_id,question_id) do update set first_choice=coalesce(public.qe_scroll_progress.first_choice,choice),
              first_correct=coalesce(public.qe_scroll_progress.first_correct,is_correct),first_answered_at=coalesce(public.qe_scroll_progress.first_answered_at,now()),
              last_choice=choice,last_correct=is_correct,attempts=public.qe_scroll_progress.attempts+1,updated_at=now();
          if is_first then
            insert into public.qe_study_events(user_id,event_id,module,xp) values(account_id,i.id,'scroll',earned);
            insert into public.qe_study_stats(user_id,scroll_questions,total_xp) values(account_id,1,earned)
              on conflict(user_id) do update set scroll_questions=public.qe_study_stats.scroll_questions+1,total_xp=public.qe_study_stats.total_xp+earned;
          end if;
        end if;
        update public.qe_scroll_items set status=result_status,selected=choice,correct=is_correct,xp=earned,active_ms=active_time,answered_at=now() where id=i.id;
        update public.qe_scroll_sessions set completed=completed+1,answered=answered+case when result_status='answered' then 1 else 0 end,
          correct=correct+case when is_correct then 1 else 0 end,xp=xp+earned,active_ms=active_ms+active_time,
          streak=case when is_correct then streak+1 else 0 end where id=s.id returning * into s;
      end if;
    end if;
  elsif p_action='finish' then
    update public.qe_scroll_sessions set finished_at=coalesce(finished_at,now()) where id=s.id returning * into s;
  elsif p_action='next' then
    if exists(select 1 from public.qe_scroll_items where session_id=s.id and position=s.current_position and status<>'pending') then
      update public.qe_scroll_sessions set current_position=current_position+1 where id=s.id returning * into s;
    end if;
  elsif p_action not in ('read','start') then
    raise exception 'INVALID_ACTION' using errcode='22023';
  end if;

  -- A second device may have answered a prefetched question in the meantime.
  if s.mode in ('feed','session') and p_action in ('read','next','start') then
    update public.qe_scroll_items i set status='superseded'
      where i.session_id=s.id and i.status='pending' and exists(select 1 from public.qe_scroll_progress p where p.user_id=account_id and p.question_id=i.question_id and p.first_answered_at is not null);
    while exists(select 1 from public.qe_scroll_items where session_id=s.id and position=s.current_position and status='superseded') loop
      update public.qe_scroll_sessions set current_position=current_position+1 where id=s.id returning * into s;
    end loop;
  end if;
  if s.finished_at is null and s.target is not null and s.completed>=s.target and p_action in ('next','read') then
    update public.qe_scroll_sessions set finished_at=now() where id=s.id returning * into s;
  end if;
  if s.finished_at is null then
    select count(*) into remaining from public.qe_scroll_items where session_id=s.id and status='pending';
    remaining:=greatest(0,least(3-remaining,coalesce(s.target-s.completed-remaining,3)));
    select coalesce(max(position),0) into next_position from public.qe_scroll_items where session_id=s.id;
    insert into public.qe_scroll_items(session_id,question_id,position)
      select s.id,c.id,next_position+row_number() over(order by md5(c.id||s.id::text)) from (
        select q.id from public.qe_enem_questions q
        left join public.qe_scroll_progress p on p.question_id=q.id and p.user_id=account_id
        where q.published and (s.area='all' or q.area=s.area) and (s.year is null or q.year=s.year)
          and (q.language is null or q.language=s.language)
          and not exists(select 1 from public.qe_scroll_items seen where seen.session_id=s.id and seen.question_id=q.id)
          and case s.mode when 'errors' then p.last_correct=false when 'favorites' then p.favorite=true else p.first_answered_at is null end
        order by md5(q.id||s.id::text) limit remaining
      ) c;
    -- Superseded prefetched items leave holes in the sequence.
    if not exists(select 1 from public.qe_scroll_items where session_id=s.id and position=s.current_position) then
      update public.qe_scroll_sessions set current_position=coalesce((select min(position) from public.qe_scroll_items where session_id=s.id and status='pending'),current_position) where id=s.id returning * into s;
    end if;
    update public.qe_scroll_items set offered_at=now(),deadline=case when s.timed then now()+make_interval(secs=>s.duration) end
      where session_id=s.id and position=s.current_position and offered_at is null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'question',public.qe_scroll_question(q),
    'favorite',coalesce(p.favorite,false),'status',i.status,'selected',i.selected,'correct',i.correct,'xp',i.xp,
    'correctIndex',case when i.status='answered' then q.correct_index end,'activeMs',i.active_ms,'deadline',i.deadline,'pausedAt',i.paused_at) order by i.position),'[]'::jsonb)
    into records from public.qe_scroll_items i join public.qe_enem_questions q on q.id=i.question_id
    left join public.qe_scroll_progress p on p.question_id=q.id and p.user_id=account_id
    where i.session_id=s.id and i.position>=s.current_position and i.position<s.current_position+3 and i.status<>'superseded';
  result:=jsonb_build_object('id',s.id,'mode',s.mode,'target',s.target,'timed',s.timed,'duration',s.duration,'completed',s.completed,
    'answered',s.answered,'correct',s.correct,'xp',s.xp,'streak',s.streak,'activeMs',s.active_ms,'finished',s.finished_at is not null,
    'exhausted',jsonb_array_length(records)=0,'items',records);
  return result;
end;
$$;
revoke all on function public.qe_scroll_command(text,jsonb) from public,anon;
grant execute on function public.qe_scroll_command(text,jsonb) to authenticated;

-- Scroll rewards now require a real question; the calculator's existing contract remains valid.
create or replace function public.qe_record_study_activity(p_event_id uuid,p_module text,p_xp integer)
returns setof public.qe_study_stats language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); inserted integer;
begin
  if account_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_module='scroll' then raise exception 'SCROLL_UPDATE_REQUIRED' using errcode='22023'; end if;
  if p_event_id is null or p_module is distinct from 'calculator' or p_xp is null or p_xp<0 or p_xp>60 then raise exception 'INVALID_ACTIVITY' using errcode='22023'; end if;
  insert into public.qe_study_events(user_id,event_id,module,xp) values(account_id,p_event_id,p_module,p_xp) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
    insert into public.qe_study_stats(user_id,calculator_rounds,total_xp) values(account_id,1,p_xp)
      on conflict(user_id) do update set calculator_rounds=public.qe_study_stats.calculator_rounds+1,total_xp=public.qe_study_stats.total_xp+p_xp;
  end if;
  return query select * from public.qe_study_stats where user_id=account_id;
end;
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('qe-enem-assets','qe-enem-assets',true,10485760,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
