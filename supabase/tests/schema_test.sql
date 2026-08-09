begin;
select plan(14);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_results' and policyname = 'Task managers can read all results'),
  'task managers have a read policy for results'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'tasks_valid_training_type'),
  'task types are constrained'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'season_players_one_open_period_idx'),
  'only one open membership period is allowed'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'task_results_task_id_fkey' and confdeltype = 'c'),
  'deleting a task cascades to its results'
);
select is(
  public.normalize_display_name('  maría   lópez  '),
  'María López',
  'profile names are normalized as title case'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'profiles_normalize_display_name' and not tgisinternal),
  'profile name normalization trigger exists'
);
select ok(to_regclass('public.matches') is not null, 'matches table exists');
select ok(to_regclass('public.match_availability') is not null, 'match availability table exists');
select ok(to_regclass('public.match_lineup') is not null, 'match lineup table exists');
select ok(to_regprocedure('public.save_match_lineup(uuid,jsonb,boolean)') is not null, 'atomic lineup save function exists');
select is(
  (select count(*)::integer from pg_constraint where confrelid = 'public.matches'::regclass and confdeltype = 'c'),
  2,
  'deleting a match cascades to availability and lineup'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'match_kind'),
  'matches store official or friendly kind'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'rugby_format'),
  'matches store rugby format'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_lineup' and column_name = 'slot_number'),
  'lineups store numbered slots'
);

select * from finish();
rollback;
