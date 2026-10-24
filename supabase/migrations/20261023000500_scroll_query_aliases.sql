-- SQL aliases refer to columns; unaliased row references remain PL/pgSQL variables.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.qe_scroll_command_core(text,jsonb)'::regprocedure);
  definition:=replace(definition,E'\ndeclare\n',E'\n#variable_conflict use_column\ndeclare\n');
  if position('#variable_conflict use_column' in definition)=0 then raise exception 'Scroll function body not found'; end if;
  execute definition;
end;
$migration$;
