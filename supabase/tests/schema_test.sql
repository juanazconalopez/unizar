begin;
select plan(500);

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
select like(
  pg_get_functiondef('public.get_season_attendance_report(uuid)'::regprocedure),
  '%p.is_player%',
  'season attendance report filters non-player profiles'
);
select like(
  pg_get_functiondef('public.get_season_attendance_report(uuid)'::regprocedure),
  '%p.is_approved%',
  'season attendance report filters unapproved profiles'
);
select like(
  pg_get_functiondef('public.get_season_attendance_report(uuid)'::regprocedure),
  '%p.is_active%',
  'season attendance report filters inactive profiles'
);
select like(
  pg_get_functiondef('public.get_season_attendance_report(uuid)'::regprocedure),
  '%not p.is_archived%',
  'season attendance report filters archived profiles'
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
select has_function('public', 'normalize_international_phone', array['text'], 'phone values are normalized to their international form');
select has_function('public', 'is_valid_international_phone', array['text'], 'international phone validation is available to protected profile updates');
select ok(public.is_valid_international_phone('+34670675022'), 'a valid Spanish E.164 telephone is accepted');
select ok(not public.is_valid_international_phone('670675022'), 'a telephone without its international prefix is rejected');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_private_details'::regclass
      and conname = 'profile_private_details_phone_international'
  ),
  'private phone details require the E.164 international format'
);
select like(
  pg_get_functiondef('public.update_own_profile(text,text,date,text)'::regprocedure),
  '%normalize_international_phone%',
  'own profile updates normalize telephone numbers'
);
select like(
  pg_get_functiondef('public.update_managed_profile(uuid,text,text,date,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure),
  '%normalize_international_phone%',
  'managed profile updates normalize telephone numbers'
);
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
  '%current_user_has_permission%calendar.view_manage%',
  'the season birthday calendar requires its explicit management capability'
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
select ok(to_regclass('public.season_competitions') is not null, 'season competitions table exists');
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'competition_id'),
  'matches identify their season competition'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'matches_competition_season_fkey' and confdeltype = 'c'),
  'deleting a season competition cascades to its matches'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'matches_kind_competition_check'),
  'official and friendly matches enforce their competition assignment'
);
select is(
  (select count(*)::integer from pg_indexes where schemaname = 'public' and indexname = 'season_competitions_default_idx'),
  1,
  'each season has at most one default competition'
);
select ok(
  exists (select 1 from public.permission_definitions where key = 'seasons.competitions' and owner_only and not configurable),
  'season competition management is an owner-only capability'
);
select has_function('public', 'create_season_competition', array['uuid','text','text','text','boolean','boolean'], 'season competitions can be created atomically');
select has_function('public', 'update_season_competition', array['uuid','text','text','text','boolean','boolean'], 'season competitions can be updated atomically');
select has_function('public', 'set_default_season_competition', array['uuid'], 'the default season competition can be changed atomically');
select has_function('public', 'delete_season_competition', array['uuid'], 'season competitions can be deleted atomically');
select like(
  pg_get_functiondef('public.create_season_competition(uuid,text,text,text,boolean,boolean)'::regprocedure),
  '%current_user_has_permission(''seasons.competitions'')%',
  'creating a season competition checks its owner-only permission'
);
select like(
  pg_get_functiondef('public.delete_season_competition(uuid)'::regprocedure),
  '%set lineup_published = false%',
  'competition deletion unlocks published lineups before cascading their data'
);
select ok(
  has_function_privilege('authenticated', 'public.create_season_competition(uuid,text,text,text,boolean,boolean)', 'EXECUTE'),
  'authenticated owners can call season competition creation'
);
select ok(
  not has_function_privilege('anon', 'public.create_season_competition(uuid,text,text,text,boolean,boolean)', 'EXECUTE'),
  'anonymous users cannot create season competitions'
);
select ok(
  not has_function_privilege('anon', 'public.delete_season_competition(uuid)', 'EXECUTE'),
  'anonymous users cannot delete season competitions'
);
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
  (select count(*)::integer from pg_constraint where confrelid = 'public.matches'::regclass and confdeltype = 'c'
    and conrelid in ('public.match_availability'::regclass, 'public.match_lineup'::regclass)),
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
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'callup_time'),
  'matches store the optional callup time'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'callup_venue'),
  'matches store the optional callup venue'
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
select has_function('public', 'link_provisional_players', array['uuid[]', 'uuid'], 'owners can link multiple provisional histories at once');
select like(
  pg_get_functiondef('public.link_provisional_players(uuid[],uuid)'::regprocedure),
  '%current_user_is_owner%',
  'only the owner can link multiple provisional histories'
);
select ok(
  has_function_privilege('authenticated', 'public.link_provisional_players(uuid[],uuid)', 'execute'),
  'authenticated users can call the protected multiple provisional link RPC'
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
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners and users can read private profile photos'),
  'only owners and the profile holder can read a private photo'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners can upload private profile photos'),
  'only owners can upload private profile photos'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners can delete private profile photos'),
  'only owners can remove obsolete profile photos'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Owners can upload private profile photos'
    and with_check like '%current_user_can_view_private_profile_details%'),
  'photo uploads check active owner status'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Owners can delete private profile photos'
    and qual like '%current_user_can_view_private_profile_details%'),
  'photo deletion checks active owner status'
);
select ok(
  not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname in ('Owners and players can upload private player photos', 'Owners and players can delete private player photos')),
  'old shared photo write policies were removed'
);
select unlike(
  (select qual from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Owners and users can read private profile photos'),
  '%target.is_player%',
  'private profile photo reads do not depend on the player role'
);
select like(
  (select with_check from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Owners can upload private profile photos'),
  '%target.is_active%',
  'photo uploads require an active target profile'
);
select unlike(
  (select with_check from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Owners can upload private profile photos'),
  '%target.is_player%',
  'photo uploads do not require the target to be a player'
);
select has_function('public', 'update_own_profile', array['text', 'text', 'date', 'text'], 'players can update their own details');
select like(pg_get_functiondef('public.update_own_profile(text,text,date,text)'::regprocedure), '%new_avatar_path is distinct from%', 'own profile RPC rejects photo changes');
select has_function('public', 'set_managed_player_photo', array['uuid', 'text'], 'owner has a dedicated photo update RPC');
select ok(has_function_privilege('authenticated', 'public.set_managed_player_photo(uuid,text)', 'EXECUTE'), 'authenticated owner can call photo RPC');
select ok(not has_function_privilege('anon', 'public.set_managed_player_photo(uuid,text)', 'EXECUTE'), 'anonymous users cannot call photo RPC');
select like(pg_get_functiondef('public.set_managed_player_photo(uuid,text)'::regprocedure), '%current_user_can_view_private_profile_details%', 'photo RPC checks active owner');
select like(pg_get_functiondef('public.set_managed_player_photo(uuid,text)'::regprocedure), '%and is_approved and is_active and not is_archived%', 'photo RPC only updates approved active profiles');
select unlike(pg_get_functiondef('public.set_managed_player_photo(uuid,text)'::regprocedure), '%and is_player%', 'photo RPC accepts every active profile role');
select has_function('public', 'update_managed_profile', array['uuid', 'text', 'text', 'date', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'text'], 'owners update details and permissions atomically');
select like(pg_get_functiondef('public.update_managed_profile(uuid,text,text,date,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure), '%avatar_path = new_avatar_path%', 'role changes preserve profile photos');
select has_function('public', 'archive_profile_as_owner', array['uuid'], 'owners archive profiles through a protected function');
select ok(to_regclass('public.library_settings') is not null, 'library settings are persisted');
select ok(to_regclass('public.library_items') is not null, 'library metadata items are persisted');
select has_function('public', 'current_user_can_read_library', array[]::text[], 'approved active users can read the library');
select has_function('public', 'set_library_folder', array['text', 'text', 'text'], 'owners can change the Drive folder');
select has_function('public', 'replace_library_catalog', array['text', 'text', 'text', 'jsonb', 'timestamp with time zone'], 'Drive catalog replacement is atomic');
select like(
  pg_get_functiondef('public.set_library_folder(text,text,text)'::regprocedure),
  '%delete from public.library_items%where drive_file_id is not null%',
  'changing the Drive folder uses a safe DELETE clause'
);

select ok(to_regclass('public.content_images') is not null, 'content image metadata is persisted');
select ok(to_regclass('public.content_image_references') is not null, 'content images are related to their parent content');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.content_images'::regclass),
  'content image metadata uses row level security'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'content_images_path_format'),
  'content image paths are restricted to the creator and immutable image id'
);
select has_function('public', 'current_user_can_read_content_image', array['uuid'], 'content image reads use a protected permission helper');
select has_function('public', 'cleanup_content_images', array['uuid[]'], 'unreferenced content images can be cleaned up');
select has_function('public', 'cleanup_my_abandoned_content_images', array[]::text[], 'abandoned uploads can be cleaned up without a scheduled function');
select like(
  pg_get_functiondef('public.current_user_can_read_content_image(uuid)'::regprocedure),
  '%current_user_is_active_player%',
  'player image reads require an active player profile'
);
select like(
  pg_get_functiondef('public.current_user_can_read_content_image(uuid)'::regprocedure),
  '%membership.active_until%',
  'player image reads respect season membership periods'
);
select ok(
  has_function_privilege('authenticated', 'public.cleanup_content_images(uuid[])', 'EXECUTE'),
  'authenticated sport managers can invoke protected image cleanup'
);
select ok(
  not has_function_privilege('anon', 'public.cleanup_content_images(uuid[])', 'EXECUTE'),
  'anonymous users cannot invoke content image cleanup'
);
select ok(
  has_function_privilege('authenticated', 'public.cleanup_my_abandoned_content_images()', 'EXECUTE'),
  'authenticated sport managers can clean their own abandoned uploads'
);
select ok(
  exists (
    select 1 from storage.buckets
    where id = 'content-images' and not public and file_size_limit = 614400
      and allowed_mime_types = array['image/webp']
  ),
  'the private content image bucket limits size and format'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Eligible users can read private content images'),
  'private content images use the content permission helper for reads'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Sport managers can upload private content images'),
  'only sport managers can upload content images to their own folder'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Sport managers can delete private content images'),
  'only sport managers can delete content images'
);
select is(
  (select count(*)::integer from pg_trigger where tgname in (
    'tasks_sync_content_image_references',
    'announcements_sync_content_image_references',
    'training_plans_sync_content_image_references',
    'training_exercises_sync_content_image_references',
    'training_exercises_delete_content_image_references',
    'training_presets_sync_content_image_references'
  ) and not tgisinternal),
  6,
  'all supported text content derives its image references automatically'
);

select has_table('public', 'permission_definitions', 'the permission catalog is persisted');
select has_table('public', 'role_permissions', 'current grants are persisted by role');
select has_table('public', 'role_permission_defaults', 'default grants can be restored');
select has_table('public', 'permission_audit_log', 'permission changes are audited');
select has_function('public', 'current_user_has_permission', array['text'], 'permission checks use one SQL authority');
select has_function('public', 'get_my_permissions', array[]::text[], 'users can load their effective permissions');
select has_function('public', 'set_role_permissions', array['text', 'text[]'], 'owners can atomically update a role');
select has_function('public', 'reset_role_permissions', array['text'], 'owners can restore role defaults');
select ok((select relrowsecurity from pg_class where oid = 'public.permission_definitions'::regclass), 'permission definitions use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.role_permissions'::regclass), 'role grants use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.role_permission_defaults'::regclass), 'role defaults use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.permission_audit_log'::regclass), 'permission audit uses RLS');
select ok(has_function_privilege('authenticated', 'public.get_my_permissions()', 'EXECUTE'), 'authenticated users can load effective permissions');
select ok(not has_function_privilege('anon', 'public.get_my_permissions()', 'EXECUTE'), 'anonymous users cannot load effective permissions');
select ok(has_function_privilege('authenticated', 'public.set_role_permissions(text,text[])', 'EXECUTE'), 'authenticated owners can call the protected permission update');
select ok(not has_function_privilege('anon', 'public.set_role_permissions(text,text[])', 'EXECUTE'), 'anonymous users cannot update permissions');
select cmp_ok((select count(*) from public.permission_definitions), '>=', 60::bigint, 'the catalog covers all current application areas');
select is(
  (select count(*)::integer from pg_trigger where tgname = 'enforce_configurable_permission' and not tgisinternal),
  13,
  'all configurable mutation tables enforce permissions even through security definer RPCs'
);
select like(
  pg_get_functiondef('public.enforce_configurable_permission()'::regprocedure),
  '%if tg_table_name = ''tasks'' then%',
  'the shared permission trigger narrows task rows before reading task-only fields'
);
select has_table('public', 'surveys', 'season surveys are persisted');
select has_function('public', 'can_preview_player', array['uuid'], 'owners can validate a player preview target');
select ok(has_function_privilege('authenticated', 'public.can_preview_player(uuid)', 'EXECUTE'), 'authenticated users can invoke the protected preview validator');
select ok(not has_function_privilege('anon', 'public.can_preview_player(uuid)', 'EXECUTE'), 'anonymous users cannot validate preview targets');
select has_function('public', 'get_player_preview_survey_closures', array['uuid', 'date', 'date'], 'preview calendars receive only player-visible survey closures');
select ok(has_function_privilege('authenticated', 'public.get_player_preview_survey_closures(uuid,date,date)', 'EXECUTE'), 'authenticated owners can invoke protected preview survey closures');
select ok(not has_function_privilege('anon', 'public.get_player_preview_survey_closures(uuid,date,date)', 'EXECUTE'), 'anonymous users cannot invoke preview survey closures');
select ok(
  exists (select 1 from pg_constraint where conname = 'surveys_description_length'),
  'survey descriptions have a bounded optional length'
);
select has_table('public', 'survey_questions', 'survey questions are persisted');
select has_table('public', 'survey_recipients', 'published survey recipients are fixed');
select has_table('public', 'survey_responses', 'survey responses are persisted separately');
select has_table('public', 'survey_answers', 'answers support every question type');
select has_function('public', 'publish_survey', array['uuid'], 'surveys are published atomically');
select has_function('public', 'submit_survey_response', array['uuid', 'jsonb'], 'players submit answers atomically');
select has_function('public', 'get_my_calendar_surveys', array['date', 'date'], 'players receive their active and closed calendar surveys');
select has_function('public', 'get_my_survey_response', array['uuid'], 'players can read their own private response without exposing team data');
select has_function('public', 'get_survey_results', array['uuid', 'uuid'], 'results enforce visibility through a protected RPC');
select has_function('public', 'save_survey_draft', array['uuid', 'uuid', 'text', 'text', 'date', 'date', 'public.survey_visibility', 'jsonb'], 'survey drafts are saved atomically');
select has_function('public', 'get_survey_draft', array['uuid'], 'draft editors can load their existing description and questions');
select like(
  pg_get_functiondef('public.save_survey_draft(uuid,uuid,text,text,date,date,public.survey_visibility,jsonb)'::regprocedure),
  '%La descripción no puede superar los 600 caracteres%',
  'draft saving limits the optional survey description'
);
select like(
  pg_get_functiondef('public.get_manage_surveys()'::regprocedure),
  '%''description'', survey.description%',
  'survey management receives the description'
);
select like(
  pg_get_functiondef('public.get_survey_results(uuid,uuid)'::regprocedure),
  '%''description'', checked_survey.description%',
  'survey results retain their description'
);
select like(
  pg_get_functiondef('public.get_survey_results(uuid,uuid)'::regprocedure),
  '%''recipientStatus'', case when is_owner%',
  'only the owner receives the recipient response status list'
);
select like(
  pg_get_functiondef('public.get_survey_results(uuid,uuid)'::regprocedure),
  '%''selectedAnswer'', case when checked_player_id is null%',
  'individual survey responses include the selected answer values'
);
select like(
  pg_get_functiondef('public.get_survey_results(uuid,uuid)'::regprocedure),
  '%La jugadora no forma parte de esta encuesta%',
  'individual response access is limited to invited recipients'
);
select like(
  pg_get_functiondef('public.submit_survey_response(uuid,jsonb)'::regprocedure),
  '%on conflict (survey_id, player_id) do update set submitted_at = now()%',
  'a player response is replaced atomically while the survey remains open'
);
select like(
  pg_get_functiondef('public.get_survey_for_response(uuid)'::regprocedure),
  '%''answers'', coalesce(%',
  'active surveys return the player\'s saved answers for editing'
);
select like(
  pg_get_functiondef('public.get_my_calendar_surveys(date,date)'::regprocedure),
  '%join public.survey_recipients recipient%',
  'calendar surveys are scoped to the invited player'
);
select like(
  pg_get_functiondef('public.get_my_calendar_surveys(date,date)'::regprocedure),
  '%survey.starts_on <= checked_until and survey.ends_on >= checked_from%',
  'open surveys are returned for every overlapping calendar day'
);
select like(
  pg_get_functiondef('public.get_my_calendar_surveys(date,date)'::regprocedure),
  '%''respondedOn''%',
  'calendar surveys expose only the date of the player’s latest active response'
);
select like(
  pg_get_functiondef('public.get_visible_survey_closures(date,date)'::regprocedure),
  '%survey.starts_on <= checked_until and survey.ends_on >= checked_from%',
  'managers receive open survey ranges for calendar lines'
);
select like(
  pg_get_functiondef('public.get_visible_survey_closures(date,date)'::regprocedure),
  '%''result_date'', survey.ends_on + 1%',
  'managers receive the Q on the day after the planned close, including for provisional results'
);
select ok(has_function_privilege('authenticated', 'public.get_my_survey_response(uuid)', 'EXECUTE'), 'authenticated players can load their own response');
select ok(not has_function_privilege('anon', 'public.get_my_survey_response(uuid)', 'EXECUTE'), 'anonymous users cannot load player survey responses');
select ok(has_function_privilege('authenticated', 'public.save_survey_draft(uuid,uuid,text,text,date,date,public.survey_visibility,jsonb)', 'EXECUTE'), 'authenticated managers can invoke protected draft saving');
select ok(not has_function_privilege('anon', 'public.save_survey_draft(uuid,uuid,text,text,date,date,public.survey_visibility,jsonb)', 'EXECUTE'), 'anonymous users cannot save survey drafts');
select like(
  pg_get_functiondef('public.get_manage_surveys()'::regprocedure),
  '%survey.visibility <> ''private''%',
  'the management list excludes private surveys for non-owners'
);
select like(
  pg_get_functiondef('public.publish_survey(uuid)'::regprocedure),
  '%Solo el owner puede publicar encuestas privadas%',
  'only the owner can publish a private survey'
);
select like(
  pg_get_functiondef('public.enforce_configurable_permission()'::regprocedure),
  '%when ''task_results'' then ''tasks.submit_own''%',
  'the shared permission trigger allows task-result submissions without task-only fields'
);
select like(
  pg_get_functiondef('public.enforce_configurable_permission()'::regprocedure),
  '%if tg_table_name = ''matches'' then%',
  'the shared permission trigger narrows match rows before reading match-only fields'
);
select like(
  pg_get_functiondef('public.enforce_configurable_permission()'::regprocedure),
  '%if tg_op = ''DELETE'' then%availability_player_id := old.player_id%',
  'the shared permission trigger handles availability deletes without NEW rows'
);
select has_table('public', 'season_holidays', 'season holidays are persisted');
select has_function('public', 'set_season_holidays', array['uuid', 'date[]'], 'owners can replace a season holiday list atomically');
select ok((select relrowsecurity from pg_class where oid = 'public.season_holidays'::regclass), 'season holidays use RLS');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'season_holidays' and policyname = 'Active members can read season holidays'),
  'eligible members can read season holidays'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'season_holidays_guard_date' and not tgisinternal),
  'season holidays reject dates outside their season'
);
select ok(has_function_privilege('authenticated', 'public.set_season_holidays(uuid,date[])', 'EXECUTE'), 'authenticated owners can call the protected holiday update');
select ok(not has_function_privilege('anon', 'public.set_season_holidays(uuid,date[])', 'EXECUTE'), 'anonymous users cannot update holidays');

select has_table('public', 'season_teams', 'season teams are persisted');
select has_table('public', 'season_team_coaches', 'team coach assignments are persisted');
select has_column('public', 'season_team_coaches', 'role', 'team coach assignments store a coaching role');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'season_team_coaches_one_head_idx'), 'each team can have at most one head coach');
select ok((select relrowsecurity from pg_class where oid = 'public.season_teams'::regclass), 'season teams use RLS');
select col_is_fk('public', 'season_players', 'season_team_id', 'season player assignments reference a season team');
select col_is_fk('public', 'matches', 'team_id', 'official matches can reference their team');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'season_teams_one_mixed_idx'), 'a season can have at most one mixed team');
select ok(exists (select 1 from pg_trigger where tgname = 'seasons_create_default_team' and not tgisinternal), 'new seasons create their default team');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.matches'::regclass and tgname = 'enforce_configurable_permission' and tgenabled = 'O'), 'match permission trigger remains active after the team backfill');
select has_function('public', 'create_season_team', array['uuid', 'text', 'boolean', 'text'], 'owners can create season teams through a protected function');
select has_function('public', 'assign_season_player_team', array['uuid', 'uuid', 'uuid'], 'owners can reassign a season player');
select has_function('public', 'save_season_team_coaches', array['uuid', 'jsonb'], 'owners can assign team coaches and roles');
select like(pg_get_functiondef('public.save_season_team_coaches(uuid,jsonb)'::regprocedure), '%current_user_has_permission(''seasons.teams'')%', 'only authorized owners can assign team coaches');
select like(pg_get_functiondef('public.save_season_team_coaches(uuid,jsonb)'::regprocedure), '%(is_coach or is_owner)%is_approved and is_active and not is_archived%', 'active approved owners can be selected as team coaches');
select ok(not has_function_privilege('anon', 'public.save_season_team_coaches(uuid,jsonb)', 'EXECUTE'), 'anonymous users cannot assign team coaches');
select ok(has_function_privilege('authenticated', 'public.assign_season_player_team(uuid,uuid,uuid)', 'EXECUTE'), 'authenticated owner sessions can invoke player team assignment');
select ok(not has_function_privilege('anon', 'public.assign_season_player_team(uuid,uuid,uuid)', 'EXECUTE'), 'anonymous users cannot invoke player team assignment');
select like(pg_get_functiondef('public.save_match_lineup(uuid,jsonb,boolean)'::regprocedure), '%match_participation_window(other_match.match_date) = public.match_participation_window(checked_date)%', 'guardar impide reservas duplicadas el fin de semana y el mismo día');
select like(pg_get_functiondef('public.save_match_lineup(uuid,jsonb,boolean)'::regprocedure), '%lock_match_participation_window(checked_date)%for update%', 'guardar bloquea la ventana antes de la ficha');
select like(pg_get_functiondef('public.assign_active_season_on_player_authorization()'::regprocedure), '%team.is_default%', 'newly approved players join the default season team');

select has_table('public', 'player_absences', 'player absences are persisted');
select has_table('public', 'match_events', 'official match events are persisted');
select ok((select relrowsecurity from pg_class where oid = 'public.player_absences'::regclass), 'player absences use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.player_absence_private_notes'::regclass), 'medical notes use separate RLS');
select has_function('public', 'save_player_absence', array['uuid', 'uuid', 'date', 'date', 'text'], 'owners can save absences atomically');
select has_function('public', 'save_match_events', array['uuid', 'jsonb'], 'staff can save structured match events');
select has_function('public', 'get_season_player_minutes', array['uuid'], 'season playing minutes are calculated from events');
select ok(has_function_privilege('authenticated', 'public.get_season_player_minutes(uuid)', 'EXECUTE'), 'authenticated users can read protected minutes');
select unlike(pg_get_functiondef('public.player_can_access_match(uuid,uuid)'::regprocedure), '%player_has_absence_on%', 'las bajas no impiden consultar partidos');
select like(pg_get_functiondef('public.get_season_player_minutes(uuid)'::regprocedure), '%calculate_match_player_minutes%', 'season minutes use the same interval calculation as report validation');

select has_column('public', 'matches', 'internal_fixture_id', 'linked internal fixtures are stored on matches');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'matches_internal_fixture_team_idx'), 'a team has one side of each internal fixture');
select has_function('public', 'create_internal_match', array['jsonb', 'uuid', 'uuid'], 'owner can create both sides atomically');
select has_function('public', 'update_internal_match', array['uuid', 'jsonb'], 'internal fixture details update together');
select has_function('public', 'delete_internal_match', array['uuid'], 'both sides can be deleted together');
select has_function('public', 'finalize_internal_match', array['uuid'], 'owner can publish both lineups together');
select has_function('public', 'current_user_can_read_published_lineup_profile', array['uuid'], 'published lineup profile access helper exists');
select like(pg_get_functiondef('public.finalize_internal_match(uuid)'::regprocedure), '%having count(*) > 1%', 'publication rejects players in both lineups');
select like(pg_get_functiondef('public.save_match_lineup(uuid,jsonb,boolean)'::regprocedure), '%other_match.internal_fixture_id is distinct from fixture_id%', 'paired drafts may overlap until final review');
select like(pg_get_functiondef('public.save_match_lineup(uuid,jsonb,boolean)'::regprocedure), '%Solo el owner puede incorporar jugadoras de otro equipo%', 'coach cannot borrow players from another team');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'match_lineup' and policyname = 'Scoped staff and selected players can read lineups'), 'draft lineups are scoped to the assigned team');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
  and policyname = 'Players can read published lineup profiles' and qual like '%current_user_can_read_published_lineup_profile%'),
  'published lineup profiles use a helper to avoid RLS recursion');

select like(pg_get_functiondef('public.set_player_match_availability(uuid,uuid,public.availability_status,text)'::regprocedure), '%public.current_user_is_owner()%membership.season_team_id = checked_match.team_id%', 'owner can confirm a borrowed player while coaches remain team scoped');
select like(pg_get_functiondef('public.finalize_internal_match(uuid)'::regprocedure), '%public.player_has_absence_on%', 'publication rejects a player with a new absence');
select like(pg_get_functiondef('public.player_can_access_match(uuid,uuid)'::regprocedure), '%membership.active_from <= match.match_date%membership.active_until%', 'la visibilidad respeta los periodos de vinculación');

select like(pg_get_functiondef('public.current_user_can_view_season_team(uuid)'::regprocedure),
  '%current_user_has_permission(''matches.view'')%', 'team visibility requires the configurable match permission');
select like(pg_get_functiondef('public.current_user_can_view_season_team(uuid)'::regprocedure),
  '%coach.is_active and not coach.is_archived%', 'mixed team access rejects inactive coaches');
select unlike(pg_get_functiondef('public.player_can_access_match(uuid,uuid)'::regprocedure),
  '%season_team_id%', 'las jugadoras ven partidos de todos los equipos');
select like(pg_get_functiondef('public.player_can_access_match(uuid,uuid)'::regprocedure),
  '%match.status <> ''draft''%player.is_approved%player.is_active%not player.is_archived%player.is_player%', 'consultar partidos excluye borradores y perfiles inactivos');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'matches'
  and policyname = 'Scoped staff and players can read matches' and qual like '%matches.view%'),
  'match reads respect the configurable view permission');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'player_absences'
  and policyname = 'Players and owners can read absences')
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'player_absences'
  and policyname = 'Players and scoped staff can read absences'),
  'absence dates are limited to the player and owner');
select like(pg_get_functiondef('public.get_season_player_minutes(uuid)'::regprocedure),
  '%current_user_can_view_season_team(match.team_id)%', 'minutes are scoped to the coach team');

select like(pg_get_functiondef('public.finalize_internal_match(uuid)'::regprocedure),
  '%other_match.internal_fixture_id is distinct from fixture_id%',
  'final review rejects same-day reservations outside the internal fixture');

select like(pg_get_functiondef('public.update_season_team(uuid,text,boolean,boolean,text)'::regprocedure),
  '%other_match set opponent = trim(checked_name)%',
  'renaming a team updates the rival name on its paired fixture');
select like(pg_get_functiondef('public.update_season_team(uuid,text,boolean,boolean,text)'::regprocedure),
  '%Un equipo que participa en un derbi no puede convertirse en mixto%',
  'a team already in a derby cannot become mixed');

select like(pg_get_functiondef('public.assign_active_season_on_player_authorization()'::regprocedure),
  '%greatest(today_in_madrid, season.start_date)%',
  'new players join future seasons from their start date');
select like(pg_get_functiondef('public.assign_active_season_on_player_authorization()'::regprocedure),
  '%Europe/Madrid%', 'automatic season assignment uses the team timezone');

select has_column('public', 'matches', 'team_score', 'match report stores team score');
select has_column('public', 'matches', 'opponent_score', 'match report stores opponent score');
select has_column('public', 'matches', 'report_events_reviewed', 'match report review state is stored');
select has_function('public', 'save_match_report', array['uuid', 'integer', 'integer', 'integer', 'jsonb'], 'match report is saved atomically');
select ok(has_function_privilege('authenticated', 'public.save_match_report(uuid,integer,integer,integer,jsonb)', 'EXECUTE'), 'authenticated manager can call protected report RPC');
select ok(not has_function_privilege('anon', 'public.save_match_report(uuid,integer,integer,integer,jsonb)', 'EXECUTE'), 'anonymous user cannot save reports');
select ok(not has_function_privilege('authenticated', 'public.save_match_events(uuid,jsonb)', 'EXECUTE'), 'events can only be saved through the reviewed result RPC');
select like(pg_get_functiondef('public.save_match_report(uuid,integer,integer,integer,jsonb)'::regprocedure), '%current_user_can_edit_match%', 'report RPC checks match scope');
select like(pg_get_functiondef('public.save_match_report(uuid,integer,integer,integer,jsonb)'::regprocedure), '%Europe/Madrid%', 'report RPC checks match date in team timezone');
select like(pg_get_functiondef('public.get_season_player_minutes(uuid)'::regprocedure), '%report_events_reviewed%', 'unreviewed reports cannot contribute playing minutes');
select ok(exists (select 1 from storage.buckets where id = 'match-reports' and not public), 'match reports use private storage');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Match viewers can read reports' and qual like '%matches.report%'), 'report PDFs require the report permission');

select has_function('public', 'get_published_match_coaches', array['uuid'], 'published match coach names can be queried');
select ok(has_function_privilege('authenticated', 'public.get_published_match_coaches(uuid)', 'EXECUTE'), 'authenticated match viewers can call the protected coach name RPC');
select ok(not has_function_privilege('anon', 'public.get_published_match_coaches(uuid)', 'EXECUTE'), 'anonymous users cannot read published match coach names');
select like(pg_get_functiondef('public.get_published_match_coaches(uuid)'::regprocedure), '%SECURITY DEFINER%', 'coach name RPC checks access without relying on assignment RLS');
select like(pg_get_functiondef('public.get_published_match_coaches(uuid)'::regprocedure), '%current_user_has_permission(''matches.view'')%', 'coach name RPC requires match view permission');
select like(pg_get_functiondef('public.get_published_match_coaches(uuid)'::regprocedure), '%match.lineup_published%', 'coach names are exposed only after lineup publication');
select like(pg_get_functiondef('public.get_published_match_coaches(uuid)'::regprocedure), '%player_can_access_match%', 'player access to coach names remains match scoped');


select has_column('public', 'match_events', 'return_minute', 'yellow cards store their actual return minute');
select has_column('public', 'match_events', 'sort_order', 'events at the same minute preserve their reviewed order');
select has_function('public', 'calculate_match_player_minutes', array['uuid', 'jsonb'], 'playing intervals have a shared SQL validator');
select ok(not has_function_privilege('authenticated', 'public.calculate_match_player_minutes(uuid,jsonb)', 'EXECUTE'), 'clients cannot call the internal minute calculator');
select ok(not has_function_privilege('anon', 'public.calculate_match_player_minutes(uuid,jsonb)', 'EXECUTE'), 'anonymous users cannot call the minute calculator');
select like(pg_get_functiondef('public.calculate_match_player_minutes(uuid,jsonb)'::regprocedure), '%sevens%then 2 else 10%', 'yellow suspensions respect rugby format');
select like(pg_get_functiondef('public.calculate_match_player_minutes(uuid,jsonb)'::regprocedure), '%ordinality%', 'minute calculation preserves event order for reentries');
select like(pg_get_functiondef('public.calculate_match_player_minutes(uuid,jsonb)'::regprocedure), '%incoming%sent_off%', 'sent-off players cannot enter again');
select like(pg_get_functiondef('public.save_match_report(uuid,integer,integer,integer,jsonb)'::regprocedure), '%SECURITY DEFINER%', 'result saving runs through the protected RPC');
select like(pg_get_functiondef('public.save_match_report(uuid,integer,integer,integer,jsonb)'::regprocedure), '%matches.edit%', 'result saving requires match edit permission');
select unlike(pg_get_functiondef('public.save_match_report(uuid,integer,integer,integer,jsonb)'::regprocedure), '%storage.objects%', 'result saving never requires uploading a PDF');
select like(pg_get_functiondef('public.save_match_report(uuid,integer,integer,integer,jsonb)'::regprocedure), '%lineup_published%', 'official minutes require a published lineup');
select ok(not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Match managers can upload reports'), 'new match report uploads are disabled');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'match_events' and policyname = 'Match managers can read events' and qual like '%current_user_can_edit_match%'), 'saved event reading is scoped to match managers');
select ok(not exists (select 1 from pg_constraint where conrelid = 'public.matches'::regclass and conname = 'matches_report_review_check'), 'reviewed results do not require a PDF path');
select has_trigger('public', 'match_lineup', 'match_lineup_invalidate_result', 'lineup changes require reviewing minutes again');
select ok(not has_function_privilege('authenticated', 'public.invalidate_match_result_review()', 'EXECUTE'), 'clients cannot directly invalidate reviewed results');
select like(pg_get_functiondef('public.invalidate_match_result_review()'::regprocedure), '%report_events_reviewed = false%', 'lineup changes keep events but exclude unreviewed minutes');
select like(pg_get_functiondef('public.save_match_report(uuid,integer,integer,integer,jsonb)'::regprocedure), '%membership.active_from%membership.active_until%', 'saving minutes checks membership on the match date');
select like(pg_get_functiondef('public.get_season_player_minutes(uuid)'::regprocedure), '%membership.active_from%membership.active_until%', 'season minutes respect membership periods');


select has_table('public','season_player_licenses','fichas por temporada separadas de pertenencia');
select has_table('public','player_license_history','los cambios de ficha conservan auditoría');
select col_is_null('public','season_players','season_team_id','las jugadoras pueden estar vinculadas sin equipo');
select has_column('public','season_competitions','competition_level','las competiciones tienen nivel regional o nacional');
select has_column('public','season_competitions','is_league','solo las ligas nacionales computan el límite');
select has_function('public','get_player_season_memberships',array['uuid'],'consulta mínima de ficha y titularidades');
select has_function('public','set_season_player_license',array['uuid','uuid','text'],'guardar la ficha sin mover de equipo');
select ok((select relrowsecurity from pg_class where oid = 'public.season_player_licenses'::regclass),'las fichas tienen RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.player_license_history'::regclass),'la auditoría tiene RLS');
select ok(not has_table_privilege('authenticated','public.season_player_licenses','UPDATE'),'sin escritura directa de fichas');
select ok(not has_table_privilege('authenticated','public.player_license_history','INSERT'),'sin auditorías falsas desde cliente');
select ok(not has_function_privilege('anon','public.set_season_player_license(uuid,uuid,text)','EXECUTE'),'anon no puede asignar fichas');
select ok(has_function_privilege('authenticated','public.set_season_player_license(uuid,uuid,text)','EXECUTE'),'RPC disponible para owner autenticado');
select ok(not has_function_privilege('authenticated','public.national_league_starts(uuid,uuid,uuid)','EXECUTE'),'contador interno no expone estadísticas arbitrarias');
select ok(not has_function_privilege('authenticated','public.player_license_allows_match(uuid,uuid)','EXECUTE'),'elegibilidad interna no expuesta');
select like(pg_get_functiondef('public.set_season_player_license(uuid,uuid,text)'::regprocedure),'%current_user_is_owner%seasons.licenses%','solo owner con permiso puede corregir fichas');
select like(pg_get_functiondef('public.set_season_player_license(uuid,uuid,text)'::regprocedure),'%player_license_history%','cada cambio de tipo registra anterior y responsable');
select like(pg_get_functiondef('public.national_league_starts(uuid,uuid,uuid)'::regprocedure),'%completed%report_events_reviewed%starter%national%is_league%','solo titularidades confirmadas de liga nacional');
select like(pg_get_functiondef('public.player_license_allows_match(uuid,uuid)'::regprocedure),'%friendly%regional%national%< 6%','amistosos abiertos y regional bloqueada desde seis');
select has_trigger('public','match_availability','match_availability_license_guard','disponibilidad validada en base de datos');
select has_trigger('public','match_lineup','match_lineup_license_guard','propuestas validadas en base de datos');
select has_trigger('public','matches','matches_published_license_guard','publicar un derbi revalida las dos convocatorias');
select has_trigger('public','season_players','season_players_license_guard','no asignar equipo sin ficha deportiva');
select like(pg_get_functiondef('public.get_player_season_memberships(uuid)'::regprocedure),'%auth.uid%current_user_is_owner%current_user_can_view_team_data%','se limita la consulta de fichas al propio perfil o staff autorizado');
select like(pg_get_functiondef('public.player_availability_opportunities(uuid,uuid)'::regprocedure),'%player_license_allows_availability%','disponibilidad no penaliza partidos para los que no hay ficha');
select like(pg_get_functiondef('public.get_player_season_summary(uuid,uuid)'::regprocedure),'%player_license_allows_availability%','el resumen personal respeta las fichas');
select ok((select owner_only and not configurable from public.permission_definitions where key = 'seasons.licenses'),'gestión de fichas exclusiva del owner');

select has_column('public','matches','completed_at','el histórico mantiene el instante de finalización');
select has_trigger('public','matches','matches_completion_time','las correcciones conservan el instante de finalización');

select like(pg_get_functiondef('public.guard_match_player_license()'::regprocedure),'%match_availability%published%','no se registran respuestas después de finalizar un partido');

select ok(to_regprocedure('public.set_season_player_license(uuid,uuid,text,uuid)') is null,'no hay RPC de ficha que acepte cambiar el equipo');
select like(pg_get_functiondef('public.set_season_player_license(uuid,uuid,text)'::regprocedure),'%if checked_license in (''none'',''training'') then%set season_team_id = null%active_until is null%','solo las fichas no deportivas retiran el equipo actual');
select like(pg_get_functiondef('public.create_default_season_team()'::regprocedure),'%Unizar Femenino%season_player_licenses%''regional''%player_license_history%season_players%default_team_id%','la nueva temporada inicia fichas Regional con equipo predeterminado y auditoría');
select ok(not has_function_privilege('authenticated','public.create_default_season_team()','EXECUTE'),'el inicializador solo se ejecuta mediante trigger');

-- Posiciones habituales: permiso deportivo independiente de datos privados.
select has_column('public', 'profiles', 'playing_positions', 'profiles store usual sports positions');
select has_column('public', 'profiles', 'primary_position', 'profiles store a primary sports position');
select has_function('public', 'set_player_positions', array['uuid','text[]','text'], 'positions have a restricted RPC');
select ok(has_function_privilege('authenticated','public.set_player_positions(uuid,text[],text)','EXECUTE'), 'authenticated users may call the restricted positions RPC');
select ok(not has_function_privilege('anon','public.set_player_positions(uuid,text[],text)','EXECUTE'), 'anonymous users cannot change positions');
select ok(exists (select 1 from public.role_permissions where role = 'coach' and permission_key = 'team.positions'), 'coaches receive the sports positions permission');
select like(pg_get_functiondef('public.set_player_positions(uuid,text[],text)'::regprocedure), '%current_user_has_permission%team.positions%', 'positions RPC checks the configured permission');
select like(pg_get_functiondef('public.set_player_positions(uuid,text[],text)'::regprocedure), '%actor.is_owner or actor.is_coach%', 'positions RPC excludes players and management from writes');
select ok(public.valid_player_positions(array['prop','centre'], 'prop'), 'a versatile player can have one principal');
select ok(public.valid_player_positions(array[]::text[], null), 'an unassigned player has no principal');
select ok(not public.valid_player_positions(array['prop','prop'], 'prop'), 'duplicate positions are rejected');
select ok(not public.valid_player_positions(array['prop'], 'wing'), 'principal must belong to selected positions');
select ok(exists (select 1 from pg_constraint where conname = 'profiles_playing_positions_check' and conrelid = 'public.profiles'::regclass), 'valid positions are enforced on persisted rows');
select ok(exists (select 1 from pg_trigger where tgname = 'profiles_guard_playing_positions' and tgrelid = 'public.profiles'::regclass and not tgisinternal), 'direct profile writes cannot bypass position permissions');

-- 074: consultar cualquier equipo no concede permiso de respuesta sin ficha deportiva.
select has_function('public','player_license_allows_availability',array['uuid','uuid'],'elegibilidad de respuesta independiente de la convocatoria');
select ok(not has_function_privilege('authenticated','public.player_license_allows_availability(uuid,uuid)','EXECUTE'),'helper interno no expone fichas de otras jugadoras');
select like(pg_get_functiondef('public.player_license_allows_availability(uuid,uuid)'::regprocedure), '%effective.license_type in (''regional'',''national'')%public.player_license_allows_match%', 'todos los tipos de partido requieren ficha deportiva para responder');
select like(pg_get_functiondef('public.player_license_allows_availability(uuid,uuid)'::regprocedure), '%player_license_history%Europe/Madrid%player_license_allows_match%', 'los informes conservan ficha histórica, zona horaria y límite nacional');
select like(pg_get_functiondef('public.guard_match_player_license()'::regprocedure), '%tg_table_name = ''match_availability''%player_license_allows_availability%', 'el trigger protege respuestas propias y las registradas por staff');
select like(pg_get_functiondef('public.guard_match_player_license()'::regprocedure), '%season_player_licenses license%license.license_type in (''regional'',''national'')%', 'la ficha vigente también bloquea respuestas a partidos de fechas pasadas');
select like(pg_get_functiondef('public.guard_match_player_license()'::regprocedure), '%player_has_absence_on%paired.lineup_published%', 'abrir la visibilidad mantiene bajas y reservas del derbi al responder');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'match_lineup' and policyname = 'Scoped staff and selected players can read lineups' and qual like '%lineup_published%' and qual like '%player_can_access_match%'), 'convocatorias de todos los equipos se leen solo cuando se publican');


-- 075: una respuesta al derbi permite preparar cualquiera de sus convocatorias.
select has_function('public','match_fixture_availability',array['uuid'],'helper único para disponibilidad del derbi');
select has_function('public','get_match_availability',array['uuid[]','uuid'],'lectura protegida de respuestas efectivas');
select ok(not has_function_privilege('authenticated','public.match_fixture_availability(uuid)','EXECUTE'),'el helper interno no expone respuestas arbitrarias');
select ok(not has_function_privilege('anon','public.get_match_availability(uuid[],uuid)','EXECUTE'),'anon no puede leer disponibilidades');
select like(pg_get_functiondef('public.match_fixture_availability(uuid)'::regprocedure),'%related.internal_fixture_id = target.internal_fixture_id%related.season_id = target.season_id%related.match_date = target.match_date%','el pool solo comparte fichas del mismo derbi, temporada y fecha');
select like(pg_get_functiondef('public.match_fixture_availability(uuid)'::regprocedure),'%distinct on (response.player_id)%response.updated_at desc, response.match_id%','una respuesta efectiva por jugadora con último estado y desempate estable');
select like(pg_get_functiondef('public.get_match_availability(uuid[],uuid)'::regprocedure),'%matches.view%response.player_id = (select auth.uid())%matches.availability_own%player_can_access_match%matches.availability_team%current_user_can_view_season_team%','jugadoras solo leen su respuesta y staff mantiene su ámbito');
select like(pg_get_functiondef('public.save_match_lineup(uuid,jsonb,boolean)'::regprocedure),'%match_fixture_availability(checked_match_id)%','guardar B admite disponibilidad respondida en A');
select like(pg_get_functiondef('public.finalize_internal_match(uuid)'::regprocedure),'%match_fixture_availability(match.id)%','la publicación conjunta usa la misma respuesta compartida');
select like(pg_get_functiondef('public.guard_match_availability()'::regprocedure),'%related.lineup_published%delete from public.match_lineup%related.internal_fixture_id = fixture_id%','cerrar o retirar disponibilidad abarca las dos fichas');
select like(pg_get_functiondef('public.get_season_callup_report(uuid)'::regprocedure),'%match_fixture_availability%','informe de equipo reconoce respuestas de ambas fichas');
select like(pg_get_functiondef('public.get_player_season_summary(uuid,uuid)'::regprocedure),'%match_fixture_availability%','resumen personal reconoce la respuesta compartida');


-- Colores de equipos: configuración mínima, autorizada y validada en SQL.
select has_column('public', 'season_teams', 'color', 'season teams have a configurable color');
select col_not_null('public', 'season_teams', 'color', 'team color is required');
select ok(exists (select 1 from pg_attrdef definition join pg_attribute attribute on attribute.attrelid = definition.adrelid and attribute.attnum = definition.adnum where definition.adrelid = 'public.season_teams'::regclass and attribute.attname = 'color' and pg_get_expr(definition.adbin, definition.adrelid) = '''purple''::text'), 'new default teams start purple');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.season_teams'::regclass and conname = 'season_teams_color_check'), 'team colors are restricted to the palette');
select has_function('public', 'update_season_team', array['uuid', 'text', 'boolean', 'boolean', 'text'], 'team updates include a color');
select ok(to_regprocedure('public.create_season_team(uuid,text,boolean)') is null, 'legacy team creation overload is removed');
select ok(to_regprocedure('public.update_season_team(uuid,text,boolean,boolean)') is null, 'legacy team update overload is removed');
select like(pg_get_functiondef('public.create_season_team(uuid,text,boolean,text)'::regprocedure), '%current_user_has_permission(''seasons.teams'')%', 'creating colored teams requires owner permission');
select like(pg_get_functiondef('public.update_season_team(uuid,text,boolean,boolean,text)'::regprocedure), '%current_user_has_permission(''seasons.teams'')%', 'changing team color requires owner permission');
select like(pg_get_functiondef('public.create_season_team(uuid,text,boolean,text)'::regprocedure), '%checked_color is null or checked_color not in%', 'creating teams validates the color');
select like(pg_get_functiondef('public.update_season_team(uuid,text,boolean,boolean,text)'::regprocedure), '%checked_color is null or checked_color not in%', 'changing teams validates the color');
select ok(not has_function_privilege('anon', 'public.create_season_team(uuid,text,boolean,text)', 'EXECUTE'), 'anonymous users cannot create colored teams');
select ok(not has_function_privilege('anon', 'public.update_season_team(uuid,text,boolean,boolean,text)', 'EXECUTE'), 'anonymous users cannot change team colors');
select ok(has_function_privilege('authenticated', 'public.update_season_team(uuid,text,boolean,boolean,text)', 'EXECUTE'), 'authenticated owners can invoke team color updates');


-- 077: la restricción usa la última acta de la misma competición y no bloquea borradores.
select has_column('public','season_competitions','restrict_cross_team_callups','restricción configurable por competición');
select col_not_null('public','season_competitions','restrict_cross_team_callups','configuración explícita del límite');
select has_function('public','get_cross_team_callup_reference',array['uuid'],'referencia protegida para el editor');
select ok(not has_function_privilege('anon','public.get_cross_team_callup_reference(uuid)','EXECUTE'),'anon no consulta actas de referencia');
select ok(not has_function_privilege('authenticated','public.cross_team_callup_reference_internal(uuid)','EXECUTE'),'helper no permite consultar partidos fuera de ámbito');
select like(pg_get_functiondef('public.get_cross_team_callup_reference(uuid)'::regprocedure),'%matches.lineup_edit%current_user_can_edit_match%','consulta valida permiso y equipo');
select like(pg_get_functiondef('public.cross_team_callup_reference_internal(uuid)'::regprocedure),'%other.season_id = target.season_id%other.competition_id = target.competition_id%','referencia respeta temporada y competición');
select like(pg_get_functiondef('public.cross_team_callup_reference_internal(uuid)'::regprocedure),'%other.team_id <> target.team_id%','compara con el otro equipo');
select like(pg_get_functiondef('public.cross_team_callup_reference_internal(uuid)'::regprocedure),'%other.internal_fixture_id is distinct from target.internal_fixture_id%','excluye la pareja del propio derbi');
select like(pg_get_functiondef('public.cross_team_callup_reference_internal(uuid)'::regprocedure),'%previous.status = ''completed'' and previous.report_events_reviewed%','no sustituye un acta pendiente por una antigua');
select ok(exists(select 1 from pg_trigger where tgname = 'cross_team_callup_publication_guard' and tgenabled = 'O' and tgrelid = 'public.matches'::regclass),'publicación normal y conjunta protegidas por trigger');
select like(pg_get_functiondef('public.guard_cross_team_callup_publication()'::regprocedure),'%not new.lineup_published%','se permiten borradores con más de siete');
select like(pg_get_functiondef('public.guard_cross_team_callup_publication()'::regprocedure),'%count(distinct lineup.player_id)%repeated > 7%','máximo siete jugadoras únicas de toda la convocatoria');
select like(pg_get_functiondef('public.guard_cross_team_callup_publication()'::regprocedure),'%Confirma el acta del último partido del otro equipo%','sin acta confirmada no se publica');
select ok(exists(select 1 from pg_trigger where tgname = 'match_callup_competition_lock' and tgenabled = 'O' and tgrelid = 'public.matches'::regclass),'publicación y confirmación se coordinan por competición');
select like(pg_get_functiondef('public.lock_match_callup_competition()'::regprocedure),'%order by id for update%','bloqueo ordenado durante escrituras de partidos');

select like(pg_get_functiondef('public.cross_team_callup_reference_internal(uuid)'::regprocedure),'%lineup.match_id = previous.id and previous.lineup_published%','no se expone el borrador del otro equipo al consultar la restricción');

-- 078: reservas del mismo derbi sin abrir el borrador del otro equipo.
select has_function('public','get_derby_reserved_player_ids',array['uuid'],'reservas protegidas del derbi');
select ok(not has_function_privilege('anon','public.get_derby_reserved_player_ids(uuid)','EXECUTE'),'anon no consulta reservas');
select ok(has_function_privilege('authenticated','public.get_derby_reserved_player_ids(uuid)','EXECUTE'),'staff autorizado puede consultar reservas');
select like(pg_get_functiondef('public.get_derby_reserved_player_ids(uuid)'::regprocedure),'%matches.lineup_edit%current_user_can_edit_match%','reservas validan permiso y equipo');
select like(pg_get_functiondef('public.get_derby_reserved_player_ids(uuid)'::regprocedure),'%other.id <> target.id%other.internal_fixture_id = target.internal_fixture_id%','solo reserva la otra ficha del derbi');
select like(pg_get_functiondef('public.get_derby_reserved_player_ids(uuid)'::regprocedure),'%other.season_id = target.season_id%other.match_date = target.match_date%','reservas respetan temporada y fecha');
select like(pg_get_functiondef('public.get_derby_reserved_player_ids(uuid)'::regprocedure),'%array_agg(distinct lineup.player_id)%','devuelve solo identificadores únicos de titulares y suplentes');
select unlike(pg_get_functiondef('public.get_derby_reserved_player_ids(uuid)'::regprocedure),'%lineup_published%','las propuestas guardadas también reservan antes de publicar');

-- 079/080: una oportunidad y un detalle, con el mismo criterio en ambos informes.
select like(pg_get_functiondef('public.get_season_callup_report(uuid)'::regprocedure),
  '%player_availability_opportunities(checked_season_id, p.id)%as eligible_matches%', 'el informe cuenta oportunidades reales por jugadora');
select like(pg_get_functiondef('public.get_season_callup_report(uuid)'::regprocedure),
  '%player_availability_opportunities(checked_season_id, p.id)%availability_status is not null%as availability_responded%', 'una respuesta por oportunidad');
select like(pg_get_functiondef('public.get_player_season_summary(uuid,uuid)'::regprocedure),
  '%availability_totals as (%count(*)%as eligible_matches%', 'el resumen personal cuenta oportunidades únicas');
select like(pg_get_functiondef('public.get_player_season_summary(uuid,uuid)'::regprocedure),
  '%availability_totals as (%availability_status is not null%as availability_responded%', 'los estados personales no duplican oportunidades');
select like(pg_get_functiondef('public.get_player_season_summary(uuid,uuid)'::regprocedure),
  '%fixture_details as (%player_availability_opportunities%opportunity.match_id = md.id%from fixture_details md%', 'el detalle muestra el mismo partido de referencia que el cómputo');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.match_availability_coach_changes'::regclass
  and confrelid = 'public.matches'::regclass and confdeltype = 'c'), 'borrar un partido elimina también los cambios de disponibilidad');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.match_events'::regclass
  and confrelid = 'public.matches'::regclass and confdeltype = 'c'), 'borrar un partido elimina también los eventos de los que se derivan sus minutos');


-- 080: fin de semana, préstamos, permisos mínimos y protección ante escrituras directas.
select is(public.match_participation_window(date '2026-10-16'), date '2026-10-16', 'viernes abre la ventana');
select is(public.match_participation_window(date '2026-10-17'), date '2026-10-16', 'sábado comparte viernes');
select is(public.match_participation_window(date '2026-10-18'), date '2026-10-16', 'domingo comparte viernes');
select is(public.match_participation_window(date '2026-10-19'), date '2026-10-19', 'lunes no se une al fin de semana');
select is(public.match_participation_window(date '2026-11-01'), date '2026-10-30', 'el fin de semana cruza de mes');
select is(public.match_participation_window(date '2027-01-03'), date '2027-01-01', 'domingo de otra temporada conserva su viernes');
select has_function('public','get_match_lineup_reservations',array['uuid'],'RPC protegida de reservas por ventana');
select ok(not has_function_privilege('anon','public.get_match_lineup_reservations(uuid)','EXECUTE'),'anon no consulta reservas');
select ok(has_function_privilege('authenticated','public.get_match_lineup_reservations(uuid)','EXECUTE'),'staff autorizado consulta reservas');
select like(pg_get_functiondef('public.get_match_lineup_reservations(uuid)'::regprocedure),
  '%matches.lineup_edit%current_user_can_edit_match%', 'la RPC comprueba permiso y equipo');
select like(pg_get_functiondef('public.get_match_lineup_reservations(uuid)'::regprocedure),
  '%other.id <> target.id%other.status <>%match_participation_window%', 'reservas excluyen cancelados y cubren toda la ventana incluso al cambiar de temporada');
select unlike(pg_get_functiondef('public.get_match_lineup_reservations(uuid)'::regprocedure),
  '%slot_number%', 'no expone dorsales ni el borrador completo');
select ok(not has_function_privilege('authenticated','public.player_availability_opportunities(uuid,uuid)','EXECUTE'),'el helper de respuestas es privado');
select ok(not has_function_privilege('authenticated','public.match_participation_player_ids(uuid)','EXECUTE'),'el helper de convocadas es privado');
select like(pg_get_functiondef('public.player_availability_opportunities(uuid,uuid)'::regprocedure),
  '%distinct on (public.match_participation_window(match.match_date))%', 'una oportunidad por ventana');
select like(pg_get_functiondef('public.player_availability_opportunities(uuid,uuid)'::regprocedure),
  '%membership.active_from%membership.active_until%membership.season_team_id = match.team_id%team.is_mixed%lineup.player_id is not null%', 'equipo histórico, mixto y préstamo guardado');
select like(pg_get_functiondef('public.player_availability_opportunities(uuid,uuid)'::regprocedure),
  '%(lineup.player_id is not null) desc%membership.season_team_id = match.team_id%', 'la convocatoria guardada prioriza el préstamo');
select like(pg_get_functiondef('public.match_participation_player_ids(uuid)'::regprocedure),
  '%match_lineup%union%player_availability_opportunities%', 'suplentes automáticas de amistosos no duplican oportunidades');
select like(pg_get_functiondef('public.lock_match_participation_window(date)'::regprocedure),
  '%pg_advisory_xact_lock%', 'los guardados simultáneos se serializan');
select has_trigger('public','match_lineup','match_lineup_participation_guard','protección de escrituras directas de convocatoria');
select has_trigger('public','matches','matches_calendar_participation_guard','protección al publicar, restaurar o reprogramar');
select like(pg_get_functiondef('public.guard_match_calendar_participation()'::regprocedure),
  '%new.match_date,new.season_id,new.status,new.lineup_published%lock_match_participation_window%', 'el cambio de fecha o estado vuelve a comprobar las reservas');
select like(pg_get_functiondef('public.finalize_internal_match(uuid)'::regprocedure),
  '%lock_match_participation_window%match_participation_window(other_match.match_date)%', 'el derbi se publica respetando reservas de todo el fin de semana');

select * from finish();
rollback;
