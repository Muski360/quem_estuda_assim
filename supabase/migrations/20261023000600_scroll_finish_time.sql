create function public.qe_scroll_finish_time(p_session_id uuid,p_active_ms integer) returns void
language plpgsql set search_path='' as $$
begin
  if p_active_ms is null or p_active_ms<0 or p_active_ms>7200000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  with recorded as (
    update public.qe_scroll_items entry
    set active_ms=least(p_active_ms,greatest(0,coalesce(extract(epoch from now()-entry.offered_at)::integer*1000,0))),answered_at=now()
    from public.qe_scroll_sessions session
    where entry.session_id=session.id and session.id=p_session_id and session.user_id=auth.uid()
      and session.finished_at is null and entry.position=session.current_position and entry.status='pending'
    returning entry.active_ms
  )
  update public.qe_scroll_sessions session set active_ms=session.active_ms+coalesce((select sum(active_ms) from recorded),0)
    where session.id=p_session_id and session.user_id=auth.uid() and session.finished_at is null;
end;
$$;
revoke all on function public.qe_scroll_finish_time(uuid,integer) from public,anon,authenticated;

do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.qe_scroll_command(text,jsonb)'::regprocedure);
  definition:=replace(definition,'return public.qe_scroll_command_core(p_action,p_data);',
    'if p_action=''finish'' then perform public.qe_scroll_finish_time((p_data->>''sessionId'')::uuid,coalesce((p_data->>''activeMs'')::integer,0)); end if;
  return public.qe_scroll_command_core(p_action,p_data);');
  if position('qe_scroll_finish_time' in definition)=0 then raise exception 'Scroll command body not found'; end if;
  execute definition;
end;
$migration$;
