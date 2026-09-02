begin;
select plan(131);

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
select ok(to_regclass('public.profile_private_details') is not null, 'private profile details are persisted separately');
select has_column('public', 'profile_private_details', 'email', 'private profile details store the Google email');
select has_column('public', 'profile_private_details', 'phone', 'private profile details store the optional phone');
select has_column('public', 'profile_private_details', 'birth_date', 'private profile details store the optional birth date');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profile_private_details'::regclass),
  'private profile details use row level security'
);
select ok(
  exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_private_details'
      and policyname = 'Users can read their own private profile details'
      and qual like '%auth.uid()%'
  ),
  'users can read only their own private profile details'
);
select ok(
  exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_private_details'
      and policyname = 'Owners can read private profile details'
      and qual like '%current_user_can_view_private_profile_details%'
  ),
  'owners can read private profile details for team administration'
);
select has_function(
  'public', 'update_own_profile_details', array['text', 'text', 'date'],
  'active users can update their own profile details'
);
select like(
  pg_get_functiondef('public.update_own_profile_details(text,text,date)'::regprocedure),
  '%where id = (select auth.uid())%',
  'profile detail updates are restricted to the authenticated profile'
);
select ok(
  has_function_privilege('authenticated', 'public.update_own_profile_details(text,text,date)', 'EXECUTE'),
  'authenticated users can call the private profile update function'
);
select ok(
  not has_function_privilege('anon', 'public.update_own_profile_details(text,text,date)', 'EXECUTE'),
  'anonymous users cannot call the private profile update function'
);
select has_function(
  'public', 'update_profile_details_as_owner', array['uuid', 'text', 'text', 'date'],
  'owners can update another profile details through a restricted function'
);
select like(
  pg_get_functiondef('public.update_profile_details_as_owner(uuid,text,text,date)'::regprocedure),
  '%is_owner%is_approved%is_active%not is_archived%',
  'managed profile updates require an active approved owner'
);
select like(
  pg_get_functiondef('public.update_profile_details_as_owner(uuid,text,text,date)'::regprocedure),
  '%select email into current_email from auth.users where id = checked_profile_id%',
  'managed profile updates preserve the verified Google email'
);
select ok(
  has_function_privilege('authenticated', 'public.update_profile_details_as_owner(uuid,text,text,date)', 'EXECUTE'),
  'authenticated users can call the owner profile update function after its internal permission check'
);
select ok(
  not has_function_privilege('anon', 'public.update_profile_details_as_owner(uuid,text,text,date)', 'EXECUTE'),
  'anonymous users cannot call the owner profile update function'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'auth_user_email_sync' and not tgisinternal),
  'Google account email changes are synchronized to private profile details'
);
select has_function('public', 'get_today_active_player_birthdays', array[]::text[], 'today birthdays are available');
select has_function('public', 'get_active_season_birthdays', array[]::text[], 'active season birthdays are available');
select has_function('public', 'get_player_season_birthday_calendar', array[]::text[], 'players have a privacy-safe birthday calendar');
select like(
  pg_get_functiondef('public.get_today_active_player_birthdays()'::regprocedure),
  '%today_in_madrid%between season.start_date and season.end_date%',
  'today birthdays are limited to the active season'
);
select like(
  pg_get_functiondef('public.get_today_active_player_birthdays()'::regprocedure),
  '%profile.is_player%profile.is_approved%profile.is_active%not profile.is_archived%',
  'today birthdays include only active approved players'
);
select like(
  pg_get_functiondef('public.get_active_season_birthdays()'::regprocedure),
  '%current_user_can_view_private_profile_details%',
  'the season birthday calendar is owner-only'
);
select like(
  pg_get_functiondef('public.get_active_season_birthdays()'::regprocedure),
  '%birthday_on >= membership.active_from%',
  'season birthdays respect the player membership period'
);
select ok(
  has_function_privilege('authenticated', 'public.get_today_active_player_birthdays()', 'EXECUTE'),
  'authenticated users can request today birthdays'
);
select ok(
  not has_function_privilege('anon', 'public.get_active_season_birthdays()', 'EXECUTE'),
  'anonymous users cannot request the season birthday calendar'
);
select like(
  pg_get_functiondef('public.get_player_season_birthday_calendar()'::regprocedure),
  '%requester.is_player%requester.is_approved%requester.is_active%not requester.is_archived%',
  'only active approved players can request the player birthday calendar'
);
select like(
  pg_get_functiondef('public.get_player_season_birthday_calendar()'::regprocedure),
  '%birthday_on >= membership.active_from%',
  'player birthday occurrences respect membership periods'
);
select unlike(
  pg_get_function_result('public.get_player_season_birthday_calendar()'::regprocedure),
  '%age%',
  'the player birthday calendar does not expose age'
);
select ok(
  has_function_privilege('authenticated', 'public.get_player_season_birthday_calendar()', 'EXECUTE'),
  'authenticated players can call the protected birthday calendar function'
);
select ok(
  not has_function_privilege('anon', 'public.get_player_season_birthday_calendar()', 'EXECUTE'),
  'anonymous users cannot request the player birthday calendar'
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
  'installed clients retain a compatibility attendance function'
);
select ok(to_regclass('public.provisional_players') is not null, 'provisional players are persisted outside auth profiles');
select ok(to_regclass('public.provisional_training_attendance') is not null, 'provisional attendance is persisted separately');
select has_column('public', 'provisional_players', 'linked_profile_id', 'provisional players retain their confirmed link');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.provisional_players'::regclass),
  'provisional players use row level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.provisional_training_attendance'::regclass),
  'provisional attendance uses row level security'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'provisional_players' and policyname = 'Team staff can read provisional players'),
  'team staff can read provisional players'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'provisional_training_attendance' and policyname = 'Team staff can read provisional attendance'),
  'team staff can read provisional attendance'
);
select has_function('public', 'save_training_attendance', array['date', 'uuid[]', 'uuid[]', 'jsonb'], 'attendance and invited players are saved atomically');
select like(
  pg_get_functiondef('public.save_training_attendance(date,uuid[],uuid[],jsonb)'::regprocedure),
  '%current_user_can_manage_sport%',
  'only sports managers can save provisional attendance'
);
select has_function('public', 'link_provisional_player', array['uuid', 'uuid'], 'owners can link a provisional player history');
select like(
  pg_get_functiondef('public.link_provisional_player(uuid,uuid)'::regprocedure),
  '%current_user_is_owner%',
  'only the owner can link provisional attendance'
);
select ok(
  not has_table_privilege('authenticated', 'public.provisional_players', 'INSERT'),
  'authenticated users cannot bypass the provisional player RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.provisional_training_attendance', 'INSERT'),
  'authenticated users cannot bypass the provisional attendance RPC'
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

select has_column('public', 'profiles', 'avatar_path', 'profiles keep only the private photo path');
select ok(
  exists (select 1 from pg_constraint where conname = 'profiles_avatar_path_format'),
  'profile photo paths are restricted to their profile folder'
);
select ok(
  exists (
    select 1 from storage.buckets
    where id = 'player-avatars' and not public and file_size_limit = 307200
      and allowed_mime_types = array['image/jpeg']
  ),
  'the private player photo bucket limits size and format'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners and players can read private player photos'),
  'only owners and the player can read a private player photo'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners and players can upload private player photos'),
  'owners and players have a restricted upload policy'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners and players can delete private player photos'),
  'owners and players can remove obsolete photos'
);
select has_function('public', 'update_own_profile', array['text', 'text', 'date', 'text'], 'players can update their own details and photo path');
select has_function('public', 'update_managed_profile', array['uuid', 'text', 'text', 'date', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'text'], 'owners update details and permissions atomically');
select has_function('public', 'archive_profile_as_owner', array['uuid'], 'owners archive profiles through a protected function');

select * from finish();
rollback;
