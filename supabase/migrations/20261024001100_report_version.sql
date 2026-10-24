-- Keep a report attached to the explanation actually read, even during an editorial update.
drop function public.qe_report_content(text,text,text);
create function public.qe_report_content(p_question_id text,p_category text,p_message text,p_version integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); v integer;
begin
  if account_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_category is null or p_category not in ('explanation','answer','image','other') or p_message is null or char_length(trim(p_message)) not between 10 and 1000 then raise exception 'INVALID_REPORT' using errcode='22023'; end if;
  select coalesce(p_version,learning_version,0) into v from public.qe_enem_questions where id=p_question_id and published;
  if v is null then raise exception 'QUESTION_NOT_FOUND' using errcode='P0002'; end if;
  if v<0 or (v>0 and not exists(select 1 from public.qe_explanations where question_id=p_question_id and version=v)) then raise exception 'INVALID_VERSION' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text,0));
  if (select count(*) from public.qe_content_reports where user_id=account_id and created_at>now()-interval '1 day')>=20 then raise exception 'REPORT_LIMIT' using errcode='22023'; end if;
  insert into public.qe_content_reports(user_id,question_id,version,category,message) values(account_id,p_question_id,v,p_category,trim(p_message))
    on conflict(user_id,question_id,version,category) do nothing;
  return jsonb_build_object('saved',true);
end $$;
revoke all on function public.qe_report_content(text,text,text,integer) from public,anon;
grant execute on function public.qe_report_content(text,text,text,integer) to authenticated;
