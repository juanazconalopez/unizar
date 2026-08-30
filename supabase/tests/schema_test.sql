begin;
select plan(78);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_results' and policyname = 'Task managers can read all results'),
  'task managers have a read policy for results'
);
select ok(to_regclass('public.competition_seasons') is not null, 'competition seasons are persisted');

select has_function('public', 'get_season_callup_report', array['uuid'], 'season callup report is available');
select has_function('public', 'get_season_attendance_report', array['uuid'], 'season attendance report is available');
select like(
  pg_get_functiondef('public.get_season_attendance_report(uuid)'::regprocedure),
  '%current_user_can_view_team_data%',
  'owners, coaches and management can load the season attendance report'
);
select has_function('public', 'get_player_season_summary', array['uuid', 'uuid'], 'personal season summary is available');
select has_function('public', 'current_user_can_manage_sport', array[]::text[], 'sports management permission is available');
select has_function('public', 'current_user_can_view_team_data', array[]::text[], 'read-only team permission is available');
select has_function('public', 'unlock_match_lineup', array['uuid'], 'published lineups can be explicitly unlocked');
select has_function('public', 'reorder_tasks', array['uuid[]'], 'sports managers can persist the weekly task order');
select has_column('public', 'tasks', 'sort_order', 'tasks keep an explicit weekly order');
select ok(to_regclass('public.match_availability_coach_changes') is not null, 'coach availability changes are audited');
select has_function(
  'public',
  'set_player_match_availability',
  array['uuid', 'uuid', 'availability_status', 'text'],
  'owners and coaches can register a player availability response'
);
select like(
  pg_get_functiondef('public.set_player_match_availability(uuid,uuid,public.availability_status,text)'::regprocedure),
  '%and (is_owner or is_coach)%and is_approved%and is_active%and not is_archived%',
  'only active approved owners and coaches can change another player availability'
);
select like(
  pg_get_functiondef('public.set_player_match_availability(uuid,uuid,public.availability_status,text)'::regprocedure),
  '%if is_lineup_published then%Desbloquea la convocatoria%',
  'a published lineup blocks staff availability changes'
);
select like(
  pg_get_functiondef('public.set_player_match_availability(uuid,uuid,public.availability_status,text)'::regprocedure),
  '%insert into public.match_availability_coach_changes%',
  'coach availability overrides leave an audit record'
);
select like(
  pg_get_functiondef('public.unlock_match_lineup(uuid)'::regprocedure),
  '%and (is_owner or is_coach)%and is_approved%and is_active%and not is_archived%',
  'only active approved owners and coaches can unlock a published lineup'
);
select like(
  pg_get_functiondef('public.unlock_match_lineup(uuid)'::regprocedure),
  '%set lineup_published = false%',
  'unlocking returns the lineup to draft editing'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_coach'),
  'profiles identify coaches'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_viewer'),
  'profiles identify Dirección viewers'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_player'),
  'profiles identify players independently from staff roles'
);
select ok(
  not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_collaborator'),
  'legacy collaborator permission was renamed'
);
select ok(to_regclass('public.competition_fixtures') is not null, 'competition fixtures are persisted');
select ok(to_regclass('public.competition_standings') is not null, 'competition standings are persisted');
select ok(to_regclass('public.competition_player_stats') is not null, 'competition player statistics are persisted');
select ok(
  exists (select 1 from pg_constraint where conname = 'tasks_valid_training_type'),
  'task types are constrained'
);
select like(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.tasks'::regclass and conname = 'tasks_valid_training_type'),
  '%Vídeo%',
  'video is an accepted task type'
);
select like(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.tasks'::regclass and conname = 'tasks_valid_training_type'),
  '%Táctico%Técnico%',
  'legacy tactical and technical task types remain accepted'
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
select has_function('public', 'update_own_display_name', array['text'], 'active users can update their own display name');
select like(
  pg_get_functiondef('public.update_own_display_name(text)'::regprocedure),
  '%where id = (select auth.uid())%',
  'display name updates are restricted to the authenticated profile'
);
select like(
  pg_get_functiondef('public.update_own_display_name(text)'::regprocedure),
  '%and is_approved%and is_active%and not is_archived%',
  'only approved active profiles can edit their display name'
);
select ok(
  has_function_privilege('authenticated', 'public.update_own_display_name(text)', 'EXECUTE'),
  'authenticated users can call the display name function'
);
select ok(
  not has_function_privilege('anon', 'public.update_own_display_name(text)', 'EXECUTE'),
  'anonymous users cannot call the display name function'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'profiles_assign_active_season_on_authorization' and not tgisinternal),
  'authorized players are automatically assigned to the active season'
);
select like(
  pg_get_functiondef('public.assign_active_season_on_player_authorization()'::regprocedure),
  '%new.is_approved%new.is_active%new.is_player%not new.is_archived%',
  'automatic season assignment requires an approved active player'
);
select like(
  pg_get_functiondef('public.assign_active_season_on_player_authorization()'::regprocedure),
  '%s.start_date <= current_date%s.end_date >= current_date%',
  'automatic assignment selects only the current season'
);
select ok(to_regclass('public.matches') is not null, 'matches table exists');
select ok(to_regclass('public.match_availability') is not null, 'match availability table exists');
select ok(to_regclass('public.match_lineup') is not null, 'match lineup table exists');
select ok(
  exists (select 1 from pg_trigger where tgname = 'match_availability_guard_lineup' and not tgisinternal),
  'availability changes guard provisional lineup places'
);
select like(
  pg_get_functiondef('public.guard_match_availability()'::regprocedure),
  '%new.status <> ''available''::public.availability_status%delete from public.match_lineup%',
  'losing availability removes the player from the provisional lineup'
);
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
select ok(
  to_regprocedure('public.effective_callup_role(public.match_kind,boolean,public.availability_status,public.lineup_role)') is not null,
  'effective callup role is available'
);
select is(
  public.effective_callup_role('friendly', true, 'available', null),
  'substitute'::public.lineup_role,
  'an available friendly player without a slot is a substitute'
);
select is(
  public.effective_callup_role('friendly', true, 'available', 'starter'),
  'starter'::public.lineup_role,
  'an explicit friendly starter remains a starter'
);
select is(
  public.effective_callup_role('official', true, 'available', null),
  null::public.lineup_role,
  'availability alone does not create an official callup'
);
select is(
  public.effective_callup_role('friendly', false, 'available', null),
  null::public.lineup_role,
  'an unpublished friendly lineup is not counted yet'
);
select like(
  pg_get_functiondef('public.get_season_callup_report(uuid)'::regprocedure),
  '%effective_callup_role%',
  'team callup report uses effective friendly roles'
);
select like(
  pg_get_functiondef('public.get_player_season_summary(uuid,uuid)'::regprocedure),
  '%effective_callup_role%',
  'player season summary uses effective friendly roles'
);
select ok(to_regclass('public.competition_sync_runs') is not null, 'competition synchronizations are audited');
select ok(
  exists (select 1 from pg_constraint where conname = 'seasons_dates_do_not_overlap' and contype = 'x'),
  'season ranges cannot overlap'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'tasks_guard_season_dates' and not tgisinternal),
  'task weeks are checked against season dates'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'matches_guard_season_dates' and not tgisinternal),
  'match dates are checked against season dates'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'match_lineup_guard_published' and not tgisinternal),
  'published lineup rows are immutable'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'matches_guard_published_structure' and not tgisinternal),
  'published match structure is immutable'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'training_sessions' and column_name = 'season_id'),
  'training sessions belong to a season'
);
select ok(
  to_regprocedure('public.save_training_attendance(date,uuid[],uuid[])') is not null,
  'attendance is saved atomically'
);
select ok(to_regclass('public.training_plans') is not null, 'private training plans are persisted');
select ok(to_regclass('public.training_exercises') is not null, 'training plan exercises are persisted');
select ok(to_regclass('public.training_exercise_presets') is not null, 'reusable training exercises are persisted');
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'training_plans' and column_name = 'material'
  ),
  'training plans store session material'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'training_exercises'
      and column_name in ('coaching_points', 'participants', 'equipment')
  ),
  'training exercises only store the simplified exercise fields'
);
select ok(
  to_regprocedure('public.save_training_plan(uuid,uuid,date,text,text,text,public.task_status,jsonb)') is not null,
  'training plans and exercises are saved atomically'
);
select like(
  pg_get_functiondef('public.save_training_plan(uuid,uuid,date,text,text,text,public.task_status,jsonb)'::regprocedure),
  '%checked_material%',
  'training plan save function receives the session material'
);
select like(
  pg_get_functiondef('public.save_training_plan(uuid,uuid,date,text,text,text,public.task_status,jsonb)'::regprocedure),
  '%current_user_can_manage_sport%',
  'only owner and coaches can save tactical training plans'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'training_plans'
      and policyname = 'Sport managers can read training plans'
      and qual like '%current_user_can_manage_sport%'
  ),
  'training plans are not readable by players or Dirección'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'training_exercise_presets'
      and policyname = 'Sport managers can read training exercise presets'
      and qual like '%current_user_can_manage_sport%'
  ),
  'exercise presets are private to owner and coaches'
);
select ok(
  to_regprocedure('public.replace_competition_snapshot(jsonb,jsonb,jsonb,jsonb)') is not null,
  'competition snapshots are replaced atomically'
);
select ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_results' and policyname = 'Owners can delete results'),
  'owners cannot delete individual player results'
);
select like(
  pg_get_functiondef('public.save_match_lineup(uuid,jsonb,boolean)'::regprocedure),
  '%if was_published then%',
  'lineup save rejects an already published lineup'
);

select * from finish();
rollback;
