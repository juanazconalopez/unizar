begin;
select plan(6);

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

select * from finish();
rollback;
