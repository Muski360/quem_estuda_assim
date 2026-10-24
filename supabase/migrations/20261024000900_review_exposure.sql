-- Early attempts must count as exposure when measuring delayed recall.
create or replace function public.qe_schedule_review() returns trigger language plpgsql security definer set search_path='' as $$
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
    else
      update public.qe_review_queue set last_answered_at=now(),
        delayed_correct_at=case when not new.correct then null else delayed_correct_at end,
        last_review_error_at=case when not new.correct then now() else last_review_error_at end where user_id=account_id and question_id=new.question_id;
    end if;
  end if;
  perform public.qe_learning_sync();
  return new;
end $$;

do $migration$
declare definition text; signature text;
begin
  foreach signature in array array['public.qe_learning_init()','public.qe_learning_overview()'] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if position('r.due_day<=today and q.published' in definition)=0 then raise exception 'Review filter not found'; end if;
    definition:=replace(definition,'r.due_day<=today and q.published',
      'r.due_day<=today and (r.last_answered_at at time zone ''America/Sao_Paulo'')::date<today and q.published');
    execute definition;
  end loop;
  definition:=pg_get_functiondef('public.qe_scroll_command_core(text,jsonb)'::regprocedure);
  if position('r.due_day<=(now()' in definition)=0 then raise exception 'Queue filter not found'; end if;
  definition:=replace(definition,'r.due_day<=(now() at time zone ''America/Sao_Paulo'')::date)',
    'r.due_day<=(now() at time zone ''America/Sao_Paulo'')::date and (r.last_answered_at at time zone ''America/Sao_Paulo'')::date<(now() at time zone ''America/Sao_Paulo'')::date)');
  execute definition;
end $migration$;
