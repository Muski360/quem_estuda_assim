-- An already studied foreign-language question remains reviewable after changing the study language.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.qe_scroll_command_core(text,jsonb)'::regprocedure);
  if position('(q.language is null or q.language=s.language)' in definition)=0 then raise exception 'Language filter not found'; end if;
  definition:=replace(definition,'(q.language is null or q.language=s.language)',
    '(s.mode=''due'' or q.language is null or q.language=s.language)');
  execute definition;
end $migration$;
