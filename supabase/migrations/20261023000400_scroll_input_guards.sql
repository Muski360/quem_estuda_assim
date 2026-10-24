alter function public.qe_scroll_command(text,jsonb) rename to qe_scroll_command_core;
revoke all on function public.qe_scroll_command_core(text,jsonb) from public,anon,authenticated;

create function public.qe_scroll_command(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  valid boolean := false;
  uuid_pattern text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>8192 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_action in ('start','settings') then valid:=public.qe_valid_scroll_settings(p_data->'settings');
  elsif p_action='favorite' then
    valid:=jsonb_typeof(p_data->'favorite')='boolean' and p_data->>'questionId' ~ '^enem-[0-9]{4}-regular-[0-9]{1,3}(-(ingles|espanhol))?$';
  elsif p_action='history' then
    valid:=coalesce(p_data->>'filter','all') in ('all','errors','favorites')
      and (not p_data ? 'offset' or (jsonb_typeof(p_data->'offset')='number' and p_data->>'offset' ~ '^[0-9]{1,6}$' and (p_data->>'offset')::integer<=100000));
  elsif p_action in ('read','next','finish','pause','answer','skip') then
    valid:=p_data->>'sessionId' ~ uuid_pattern;
    if p_action in ('pause','answer','skip') then valid:=valid and p_data->>'itemId' ~ uuid_pattern; end if;
    if p_action='pause' then valid:=valid and jsonb_typeof(p_data->'paused')='boolean'; end if;
    if p_action in ('answer','skip') then
      valid:=valid and jsonb_typeof(p_data->'activeMs')='number' and p_data->>'activeMs' ~ '^[0-9]{1,7}$' and (p_data->>'activeMs')::integer<=7200000;
    end if;
    if p_action='answer' then valid:=valid and p_data->'choice' in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb); end if;
  end if;
  if valid is distinct from true then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  return public.qe_scroll_command_core(p_action,p_data);
end;
$$;
revoke all on function public.qe_scroll_command(text,jsonb) from public,anon;
grant execute on function public.qe_scroll_command(text,jsonb) to authenticated;
