-- Learning content is private; only an answered question unlocks its explanation.
alter table public.qe_enem_questions add column learning_version integer;
create table public.qe_explanations (
  question_id text not null references public.qe_enem_questions(id), version integer not null check(version>0),
  checksum text not null, status text not null check(status in ('draft','approved','quarantined')),
  subject text not null, topic text not null, subject_label text not null, topic_label text not null,
  content jsonb not null check(jsonb_typeof(content)='object'), reviewed_at timestamptz not null default now(),
  primary key(question_id,version)
);
create table public.qe_review_queue (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.qe_enem_questions(id), due_day date not null,
  interval_days integer not null check(interval_days in (1,3,7,14,30)),
  last_answered_at timestamptz not null default now(), delayed_correct_at timestamptz, last_review_error_at timestamptz,
  primary key(user_id,question_id)
);
create index qe_review_due on public.qe_review_queue(user_id,due_day);
create table public.qe_review_log (
  item_id uuid primary key references public.qe_scroll_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.qe_enem_questions(id), day date not null,
  correct boolean not null, gap_days integer not null, unique(user_id,question_id,day)
);
create table public.qe_learning_days (
  user_id uuid not null references auth.users(id) on delete cascade, day date not null,
  review_target integer not null check(review_target between 0 and 3), primary key(user_id,day)
);
create table public.qe_mission_awards (
  user_id uuid not null references auth.users(id) on delete cascade, day date not null,
  mission text not null check(mission in ('answers','reviews','calculator')),
  xp integer not null check(xp in (15,20)), awarded_at timestamptz not null default now(),
  primary key(user_id,day,mission)
);
create table public.qe_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('first_goal','streak_3','streak_7','reviews_10','first_mastery')),
  earned_at timestamptz not null default now(), primary key(user_id,kind)
);
create table public.qe_content_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.qe_enem_questions(id), version integer not null default 0,
  category text not null check(category in ('explanation','answer','image','other')),
  message text not null check(char_length(message) between 10 and 1000),
  status text not null default 'open' check(status in ('open','resolved')), created_at timestamptz not null default now(),
  unique(user_id,question_id,version,category)
);
do $$ declare t text; begin
  foreach t in array array['qe_explanations','qe_review_queue','qe_review_log','qe_learning_days','qe_mission_awards','qe_achievements','qe_content_reports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
alter table public.qe_study_events add column game_mode text check(game_mode in ('solo','multiplayer'));
alter table public.qe_study_events add column correct boolean;
alter table public.qe_study_events add column occurred_at timestamptz;
alter table public.qe_scroll_sessions add column explanation_only boolean not null default false;
alter table public.qe_scroll_sessions add column subject text;
alter table public.qe_scroll_sessions add column topic text;
alter table public.qe_scroll_sessions drop constraint qe_scroll_sessions_mode_check;
alter table public.qe_scroll_sessions add constraint qe_scroll_sessions_mode_check check(mode in ('feed','session','errors','favorites','due'));

-- Existing answers get a future review, without manufacturing delayed recall evidence.
insert into public.qe_review_queue(user_id,question_id,due_day,interval_days)
select user_id,question_id,(now() at time zone 'America/Sao_Paulo')::date+case when last_correct then 3 else 1 end,
  case when last_correct then 3 else 1 end from public.qe_scroll_progress where first_answered_at is not null;

create function public.qe_learning_init() returns void language plpgsql set search_path='' as $$
declare account_id uuid:=auth.uid(); today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
  if account_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text,0));
  insert into public.qe_learning_days(user_id,day,review_target)
    select account_id,today,least(3,count(*)) from public.qe_review_queue r join public.qe_enem_questions q on q.id=r.question_id
    where r.user_id=account_id and r.due_day<=today and q.published on conflict do nothing;
end $$;
revoke all on function public.qe_learning_init() from public,anon,authenticated;

create function public.qe_topic_progress() returns jsonb language sql stable set search_path='' as $$
  with ranked as (
    select e.subject,e.topic,e.subject_label,e.topic_label,p.first_correct,
      row_number() over(partition by e.subject,e.topic order by p.first_answered_at desc,q.id) as n,
      r.delayed_correct_at,r.last_review_error_at
    from public.qe_scroll_progress p join public.qe_enem_questions q on q.id=p.question_id
    join public.qe_explanations e on e.question_id=q.id and e.version=q.learning_version and e.checksum=q.checksum and e.status='approved'
    left join public.qe_review_queue r on r.question_id=q.id and r.user_id=p.user_id
    where p.user_id=auth.uid() and p.first_answered_at is not null and q.published
  ), grouped as (
    select subject,topic,subject_label,topic_label,count(*) as answered,count(*) filter(where first_correct) as correct,
      count(*) filter(where n<=5 and first_correct) as recent_correct,
      max(delayed_correct_at)>coalesce(max(last_review_error_at),'-infinity'::timestamptz) as recalled
    from ranked group by subject,topic,subject_label,topic_label
  ) select coalesce(jsonb_agg(jsonb_build_object('subject',subject,'topic',topic,'subjectLabel',subject_label,'topicLabel',topic_label,
    'answered',answered,'correct',correct,'recentCorrect',recent_correct,
    'state',case when answered>=5 and recent_correct>=4 then case when recalled then 'mastered' else 'consolidating' end else 'training' end)
    order by subject_label,topic_label),'[]'::jsonb) from grouped;
$$;
revoke all on function public.qe_topic_progress() from public,anon,authenticated;

create function public.qe_learning_sync() returns void language plpgsql set search_path='' as $$
declare account_id uuid:=auth.uid(); today date:=(now() at time zone 'America/Sao_Paulo')::date;
  answers integer; reviews integer; calculator integer; target integer; bonus integer:=0; new_bonus integer; current_streak integer:=0;
  d date; expected date:=today; goal integer;
begin
  perform public.qe_learning_init();
  select count(distinct i.question_id) into answers from public.qe_scroll_items i join public.qe_scroll_sessions s on s.id=i.session_id
    where s.user_id=account_id and i.status='answered' and (i.answered_at at time zone 'America/Sao_Paulo')::date=today;
  select count(*) into reviews from public.qe_review_log where user_id=account_id and day=today;
  select count(*) into calculator from public.qe_study_events where user_id=account_id and module='calculator' and game_mode='solo' and correct
    and (occurred_at at time zone 'America/Sao_Paulo')::date=today;
  select review_target into target from public.qe_learning_days where user_id=account_id and day=today;
  with awarded as (
    insert into public.qe_mission_awards(user_id,day,mission,xp)
    select account_id,today,v.mission,v.xp from (values ('answers',20,answers>=5),('reviews',15,target>0 and reviews>=target),('calculator',15,calculator>=5)) v(mission,xp,complete)
    where v.complete on conflict do nothing returning xp
  ) select coalesce(sum(xp),0) into new_bonus from awarded;
  bonus:=new_bonus;
  if bonus>0 then
    insert into public.qe_study_stats(user_id,total_xp) values(account_id,bonus)
      on conflict(user_id) do update set total_xp=public.qe_study_stats.total_xp+excluded.total_xp;
  end if;
  for d in select distinct (i.answered_at at time zone 'America/Sao_Paulo')::date from public.qe_scroll_items i
    join public.qe_scroll_sessions s on s.id=i.session_id where s.user_id=account_id and i.status='answered' order by 1 desc loop
    if current_streak=0 and d=today-1 then expected:=today-1; end if;
    exit when d<>expected;
    current_streak:=current_streak+1; expected:=expected-1;
  end loop;
  select coalesce((settings->>'goal')::integer,5) into goal from public.qe_scroll_settings where user_id=account_id;
  insert into public.qe_achievements(user_id,kind)
    select account_id,v.kind from (values ('first_goal',answers>=coalesce(goal,5)),('streak_3',current_streak>=3),('streak_7',current_streak>=7),
      ('reviews_10',(select count(*)>=10 from public.qe_review_log where user_id=account_id)),
      ('first_mastery',exists(select 1 from jsonb_array_elements(public.qe_topic_progress()) t where t->>'state'='mastered'))) v(kind,complete)
    where v.complete on conflict do nothing;
end $$;
revoke all on function public.qe_learning_sync() from public,anon,authenticated;

create function public.qe_schedule_review() returns trigger language plpgsql security definer set search_path='' as $$
declare account_id uuid; today date:=(now() at time zone 'America/Sao_Paulo')::date;
  previous public.qe_review_queue; days integer; gap integer;
begin
  if new.status<>'answered' or old.status='answered' then return new; end if;
  select user_id into account_id from public.qe_scroll_sessions where id=new.session_id;
  select * into previous from public.qe_review_queue where user_id=account_id and question_id=new.question_id for update;
  if previous.question_id is null then
    days:=case when new.correct then 3 else 1 end;
    insert into public.qe_review_queue(user_id,question_id,due_day,interval_days,last_answered_at)
      values(account_id,new.question_id,today+days,days,now());
  else
    gap:=today-(previous.last_answered_at at time zone 'America/Sao_Paulo')::date;
    if previous.due_day<=today and gap>0 then
      days:=case when not new.correct then 1 when previous.interval_days=1 then 3 when previous.interval_days=3 then 7 when previous.interval_days=7 then 14 else 30 end;
      insert into public.qe_review_log(item_id,user_id,question_id,day,correct,gap_days) values(new.id,account_id,new.question_id,today,new.correct,gap) on conflict do nothing;
      update public.qe_review_queue set due_day=today+days,interval_days=days,last_answered_at=now(),
        delayed_correct_at=case when not new.correct then null when gap>=7 then now() else delayed_correct_at end,
        last_review_error_at=case when not new.correct then now() else last_review_error_at end
        where user_id=account_id and question_id=new.question_id;
    elsif not new.correct then
      update public.qe_review_queue set delayed_correct_at=null,last_review_error_at=now() where user_id=account_id and question_id=new.question_id;
    end if;
  end if;
  perform public.qe_learning_sync();
  return new;
end $$;
revoke all on function public.qe_schedule_review() from public,anon,authenticated;
create trigger qe_schedule_review after update of status on public.qe_scroll_items for each row execute function public.qe_schedule_review();

create or replace function public.qe_scroll_question(q public.qe_enem_questions) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',q.id,'year',q.year,'number',q.number,'area',q.area,'language',q.language,
    'context',q.context,'prompt',q.prompt,'alternatives',q.alternatives,'source',q.source,
    'hasExplanation',e.question_id is not null,'classification',case when e.question_id is not null then
      jsonb_build_object('subject',e.subject,'topic',e.topic,'subjectLabel',e.subject_label,'topicLabel',e.topic_label) end)
  from (values(1)) dummy(n) left join public.qe_explanations e on e.question_id=q.id and e.version=q.learning_version and e.status='approved' and e.checksum=q.checksum;
$$;

create or replace function public.qe_valid_scroll_settings(s jsonb) returns boolean language sql stable set search_path='' as $$
  select coalesce(jsonb_typeof(s)='object' and s ?& array['area','year','language','mode','target','timed','minutes','goal']
    and s->>'area' in ('all','mathematics','nature','humanities','languages')
    and (s->'year'='null'::jsonb or (jsonb_typeof(s->'year')='number' and s->>'year' ~ '^[0-9]{4}$' and (s->>'year')::integer between 2009 and 2023))
    and s->>'language' in ('ingles','espanhol') and s->>'mode' in ('feed','session','errors','favorites','due')
    and s->'target' in ('5'::jsonb,'10'::jsonb,'20'::jsonb) and s->'goal' in ('5'::jsonb,'10'::jsonb,'20'::jsonb)
    and jsonb_typeof(s->'timed')='boolean' and jsonb_typeof(s->'minutes')='number' and s->>'minutes' ~ '^[0-9]{1,2}$'
    and (s->>'minutes')::integer between 1 and 30
    and (not s ? 'explanationOnly' or jsonb_typeof(s->'explanationOnly')='boolean')
    and (not s ? 'subject' or s->'subject'='null'::jsonb or s->>'subject' ~ '^[a-z][a-z0-9-]{0,59}$')
    and (not s ? 'topic' or s->'topic'='null'::jsonb or s->>'topic' ~ '^[a-z][a-z0-9-]{0,59}$'),false);
$$;

create function public.qe_learning_overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); today date:=(now() at time zone 'America/Sao_Paulo')::date; result jsonb; target integer;
begin
  perform public.qe_learning_sync();
  select review_target into target from public.qe_learning_days where user_id=account_id and day=today;
  select jsonb_build_object('day',today,'due',count(*)) into result from public.qe_review_queue r join public.qe_enem_questions q on q.id=r.question_id
    where r.user_id=account_id and r.due_day<=today and q.published;
  result:=result||jsonb_build_object('missions',(
    select jsonb_agg(jsonb_build_object('id',v.id,'target',v.target,'progress',least(v.target,v.progress),'xp',v.xp,'awarded',a.mission is not null) order by v.n)
    from (values
      (1,'answers',5,(select count(distinct i.question_id)::integer from public.qe_scroll_items i join public.qe_scroll_sessions s on s.id=i.session_id where s.user_id=account_id and i.status='answered' and (i.answered_at at time zone 'America/Sao_Paulo')::date=today),20),
      (2,'reviews',target,(select count(*)::integer from public.qe_review_log where user_id=account_id and day=today),15),
      (3,'calculator',5,(select count(*)::integer from public.qe_study_events where user_id=account_id and game_mode='solo' and correct and (occurred_at at time zone 'America/Sao_Paulo')::date=today),15)
    ) v(n,id,target,progress,xp) left join public.qe_mission_awards a on a.user_id=account_id and a.day=today and a.mission=v.id where v.target>0));
  result:=result||jsonb_build_object('achievements',coalesce((select jsonb_agg(jsonb_build_object('id',kind,'earnedAt',earned_at) order by earned_at) from public.qe_achievements where user_id=account_id),'[]'::jsonb),
    'topics',public.qe_topic_progress(),'bonusXp',coalesce((select sum(xp) from public.qe_mission_awards where user_id=account_id),0),
    'calculatorRounds',coalesce((select calculator_rounds from public.qe_study_stats where user_id=account_id),0),
    'resume',(select jsonb_build_object('id',s.id,'mode',s.mode,'answered',s.answered) from public.qe_scroll_sessions s
      where s.user_id=account_id and s.finished_at is null and (s.target is null or s.completed<s.target)
      and exists(select 1 from public.qe_scroll_items i where i.session_id=s.id and i.position>=s.current_position and i.status='pending') order by s.created_at desc limit 1),
    'coverage',jsonb_build_object('total',(select count(*) from public.qe_enem_questions where published),'explained',(select count(*) from public.qe_enem_questions q join public.qe_explanations e on e.question_id=q.id and e.version=q.learning_version and e.checksum=q.checksum and e.status='approved' where q.published)),
    'taxonomy',coalesce((select jsonb_agg(row_to_json(t) order by t."subjectLabel",t."topicLabel") from (
      select distinct q.area,e.subject,e.topic,e.subject_label as "subjectLabel",e.topic_label as "topicLabel"
      from public.qe_enem_questions q join public.qe_explanations e on e.question_id=q.id and e.version=q.learning_version and e.checksum=q.checksum and e.status='approved' where q.published
    ) t),'[]'::jsonb));
  return result;
end $$;
revoke all on function public.qe_learning_overview() from public,anon;
grant execute on function public.qe_learning_overview() to authenticated;

create function public.qe_question_explanation(p_question_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.qe_scroll_progress where user_id=auth.uid() and question_id=p_question_id and first_answered_at is not null) then
    raise exception 'ANSWER_REQUIRED' using errcode='42501'; end if;
  select jsonb_build_object('version',e.version,'summary',e.content->'summary','steps',e.content->'steps','alternatives',e.content->'alternatives') into result
    from public.qe_enem_questions q join public.qe_explanations e on e.question_id=q.id and e.version=q.learning_version and e.checksum=q.checksum and e.status='approved'
    where q.id=p_question_id and q.published;
  return result;
end $$;
revoke all on function public.qe_question_explanation(text) from public,anon;
grant execute on function public.qe_question_explanation(text) to authenticated;

create function public.qe_report_content(p_question_id text,p_category text,p_message text) returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); v integer;
begin
  if account_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_category is null or p_category not in ('explanation','answer','image','other') or p_message is null or char_length(trim(p_message)) not between 10 and 1000 then raise exception 'INVALID_REPORT' using errcode='22023'; end if;
  select coalesce(learning_version,0) into v from public.qe_enem_questions where id=p_question_id and published;
  if v is null then raise exception 'QUESTION_NOT_FOUND' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text,0));
  if (select count(*) from public.qe_content_reports where user_id=account_id and created_at>now()-interval '1 day')>=20 then raise exception 'REPORT_LIMIT' using errcode='22023'; end if;
  insert into public.qe_content_reports(user_id,question_id,version,category,message) values(account_id,p_question_id,v,p_category,trim(p_message))
    on conflict(user_id,question_id,version,category) do nothing;
  return jsonb_build_object('saved',true);
end $$;
revoke all on function public.qe_report_content(text,text,text) from public,anon;
grant execute on function public.qe_report_content(text,text,text) to authenticated;

create function public.qe_record_calculator(p_event_id uuid,p_xp integer,p_mode text default null,p_correct boolean default null,p_occurred_at timestamptz default null)
returns setof public.qe_study_stats language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); inserted integer;
begin
  if account_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_event_id is null or p_xp is null or p_xp not between 0 and 60 or (p_mode is not null and p_mode not in ('solo','multiplayer'))
    or (p_mode is not null and (p_correct is null or p_occurred_at is null or p_occurred_at>now()+interval '5 minutes')) then raise exception 'INVALID_ACTIVITY' using errcode='22023'; end if;
  perform public.qe_learning_init();
  insert into public.qe_study_events(user_id,event_id,module,xp,game_mode,correct,occurred_at)
    values(account_id,p_event_id,'calculator',p_xp,p_mode,p_correct,p_occurred_at) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
    insert into public.qe_study_stats(user_id,calculator_rounds,total_xp) values(account_id,1,p_xp)
      on conflict(user_id) do update set calculator_rounds=public.qe_study_stats.calculator_rounds+1,total_xp=public.qe_study_stats.total_xp+p_xp;
    perform public.qe_learning_sync();
  end if;
  return query select * from public.qe_study_stats where user_id=account_id;
end $$;
revoke all on function public.qe_record_calculator(uuid,integer,text,boolean,timestamptz) from public,anon;
grant execute on function public.qe_record_calculator(uuid,integer,text,boolean,timestamptz) to authenticated;
create or replace function public.qe_record_study_activity(p_event_id uuid,p_module text,p_xp integer)
returns setof public.qe_study_stats language plpgsql security definer set search_path='' as $$
begin
  if p_module is distinct from 'calculator' then raise exception 'INVALID_ACTIVITY' using errcode='22023'; end if;
  return query select * from public.qe_record_calculator(p_event_id,p_xp);
end $$;

create or replace function public.qe_scroll_command_core(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
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
  perform public.qe_learning_init();
  if p_action='settings' or p_action='start' then
    prefs:=p_data->'settings';
    if not public.qe_valid_scroll_settings(prefs) then raise exception 'INVALID_SETTINGS' using errcode='22023'; end if;
    insert into public.qe_scroll_settings(user_id,settings) values(account_id,prefs)
      on conflict(user_id) do update set settings=excluded.settings;
    if p_action='settings' then return public.qe_scroll_stats(); end if;
    insert into public.qe_scroll_sessions(user_id,mode,area,year,language,target,timed,duration,explanation_only,subject,topic)
      values(account_id,prefs->>'mode',prefs->>'area',(prefs->>'year')::integer,prefs->>'language',
        case when prefs->>'mode' in ('session','due') then (prefs->>'target')::integer end,
        prefs->>'mode'='session' and (prefs->>'timed')::boolean,(prefs->>'minutes')::integer*60,coalesce((prefs->>'explanationOnly')::boolean,false),prefs->>'subject',prefs->>'topic') returning * into s;
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
          and (not s.explanation_only or exists(select 1 from public.qe_explanations e where e.question_id=q.id and e.version=q.learning_version and e.status='approved' and e.checksum=q.checksum))
          and (s.subject is null or exists(select 1 from public.qe_explanations e where e.question_id=q.id and e.version=q.learning_version and e.status='approved' and e.checksum=q.checksum and e.subject=s.subject))
          and (s.topic is null or exists(select 1 from public.qe_explanations e where e.question_id=q.id and e.version=q.learning_version and e.status='approved' and e.checksum=q.checksum and e.topic=s.topic))
          and not exists(select 1 from public.qe_scroll_items seen where seen.session_id=s.id and seen.question_id=q.id)
          and case s.mode when 'due' then exists(select 1 from public.qe_review_queue r where r.user_id=account_id and r.question_id=q.id and r.due_day<=(now() at time zone 'America/Sao_Paulo')::date) when 'errors' then p.last_correct=false when 'favorites' then p.favorite=true else p.first_answered_at is null end
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

alter function public.qe_scroll_stats() rename to qe_scroll_stats_base;
revoke all on function public.qe_scroll_stats_base() from public,anon,authenticated;
create function public.qe_scroll_stats() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; learning jsonb;
begin
  learning:=public.qe_learning_overview();
  result:=public.qe_scroll_stats_base();
  return result||jsonb_build_object('learning',learning);
end $$;
revoke all on function public.qe_scroll_stats() from public,anon;
grant execute on function public.qe_scroll_stats() to authenticated;
