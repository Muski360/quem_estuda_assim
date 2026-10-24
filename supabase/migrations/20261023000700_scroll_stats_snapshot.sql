-- Keep the several summary queries consistent with simultaneous answers from another device.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.qe_scroll_stats()'::regprocedure);
  definition:=replace(definition,E'\n  select s.settings into settings',
    E'\n  perform pg_advisory_xact_lock(hashtextextended(account_id::text,0));\n  select s.settings into settings');
  if position('pg_advisory_xact_lock' in definition)=0 then raise exception 'Scroll stats body not found'; end if;
  execute definition;
end;
$migration$;
