-- Catálogo central de capacidades y permisos acumulables por rol.
create table public.permission_definitions (
  key text primary key,
  section_key text not null,
  section_label text not null,
  label text not null,
  description text not null default '',
  action text not null,
  parent_key text references public.permission_definitions(key),
  sort_order integer not null,
  configurable boolean not null default true,
  owner_only boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint permission_definitions_key_format check (key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  constraint permission_definitions_not_self_parent check (parent_key is null or parent_key <> key)
);

create table public.role_permissions (
  role text not null check (role in ('coach', 'viewer', 'player')),
  permission_key text not null references public.permission_definitions(key) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  primary key (role, permission_key)
);

create table public.role_permission_defaults (
  role text not null check (role in ('coach', 'viewer', 'player')),
  permission_key text not null references public.permission_definitions(key) on delete cascade,
  primary key (role, permission_key)
);

create table public.permission_audit_log (
  id bigint generated always as identity primary key,
  role text not null check (role in ('coach', 'viewer', 'player')),
  previous_permissions jsonb not null,
  new_permissions jsonb not null,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now()
);

insert into public.permission_definitions
  (key, section_key, section_label, label, description, action, parent_key, sort_order, configurable, owner_only)
values
  ('dashboard.view_personal','dashboard','Inicio','Ver panel personal','Resumen y actividad propios.','view',null,100,true,false),
  ('dashboard.view_team','dashboard','Inicio','Ver panel del equipo','Resumen general del equipo.','view',null,110,true,false),
  ('statistics.view','statistics','Resumen','Ver Resumen','Acceso a estadísticas del equipo.','view',null,200,true,false),
  ('statistics.attendance','statistics','Resumen','Ver estadísticas de asistencia','','view','statistics.view',210,true,false),
  ('statistics.tasks','statistics','Resumen','Ver estadísticas de tareas','','view','statistics.view',220,true,false),
  ('calendar.view_personal','calendar','Calendario','Ver calendario personal','','view',null,300,true,false),
  ('calendar.view_manage','calendar','Calendario','Ver calendario de gestión','','view',null,310,true,false),
  ('tasks.view_own','tasks','Tareas','Ver tareas propias','','view',null,400,true,false),
  ('tasks.submit_own','tasks','Tareas','Responder tareas propias','','edit','tasks.view_own',410,true,false),
  ('tasks.view_team','tasks','Tareas','Ver tareas del equipo','','view','calendar.view_manage',420,true,false),
  ('tasks.view_results','tasks','Tareas','Ver resultados del equipo','','view','tasks.view_team',430,true,false),
  ('tasks.create','tasks','Tareas','Crear','','create','tasks.view_team',440,true,false),
  ('tasks.edit','tasks','Tareas','Editar','','edit','tasks.view_team',450,true,false),
  ('tasks.delete','tasks','Tareas','Borrar','','delete','tasks.view_team',460,true,false),
  ('tasks.publish','tasks','Tareas','Publicar y cambiar estado','','publish','tasks.edit',470,true,false),
  ('tasks.reorder','tasks','Tareas','Reordenar','','reorder','tasks.edit',480,true,false),
  ('announcements.view','announcements','Avisos','Ver avisos publicados','','view',null,500,true,false),
  ('announcements.view_team','announcements','Avisos','Ver todos los avisos','','view','calendar.view_manage',510,true,false),
  ('announcements.create','announcements','Avisos','Crear','','create','announcements.view_team',520,true,false),
  ('announcements.edit','announcements','Avisos','Editar','','edit','announcements.view_team',530,true,false),
  ('announcements.delete','announcements','Avisos','Borrar','','delete','announcements.view_team',540,true,false),
  ('announcements.publish','announcements','Avisos','Publicar y cambiar estado','','publish','announcements.edit',550,true,false),
  ('matches.view','matches','Partidos','Ver partidos','','view',null,600,true,false),
  ('matches.create','matches','Partidos','Crear','','create','matches.view',610,true,false),
  ('matches.edit','matches','Partidos','Editar','','edit','matches.view',620,true,false),
  ('matches.delete','matches','Partidos','Borrar','','delete','matches.view',630,true,false),
  ('matches.availability_own','matches','Partidos','Responder disponibilidad propia','','edit','matches.view',640,true,false),
  ('matches.availability_team','matches','Partidos','Ver disponibilidad del equipo','','view','matches.view',650,true,false),
  ('matches.availability_edit','matches','Partidos','Modificar disponibilidad ajena','','edit','matches.availability_team',660,true,false),
  ('matches.lineup_view','matches','Partidos','Ver convocatorias publicadas','','view','matches.view',670,true,false),
  ('matches.lineup_edit','matches','Partidos','Editar convocatorias','','edit','matches.edit',680,true,false),
  ('matches.lineup_publish','matches','Partidos','Publicar convocatorias','','publish','matches.lineup_edit',690,true,false),
  ('matches.lineup_unlock','matches','Partidos','Desbloquear convocatorias','','edit','matches.lineup_edit',700,true,false),
  ('matches.report','matches','Partidos','Ver y exportar resumen de convocatorias','','export','matches.view',710,true,false),
  ('attendance.view','attendance','Asistencia','Ver registro de asistencia','','view',null,800,true,false),
  ('attendance.record','attendance','Asistencia','Registrar asistencia','','edit','attendance.view',810,true,false),
  ('attendance.report','attendance','Asistencia','Ver informes de asistencia','','view',null,820,true,false),
  ('attendance.guests','attendance','Asistencia','Registrar invitadas','','edit','attendance.record',830,true,false),
  ('training.view','training','Entrenamientos','Ver planes de entrenamiento','','view',null,900,true,false),
  ('training.create','training','Entrenamientos','Crear','','create','training.view',910,true,false),
  ('training.edit','training','Entrenamientos','Editar','','edit','training.view',920,true,false),
  ('training.delete','training','Entrenamientos','Borrar','','delete','training.view',930,true,false),
  ('training.publish','training','Entrenamientos','Publicar y cambiar estado','','publish','training.edit',940,true,false),
  ('exercises.view','exercises','Biblioteca de ejercicios','Ver ejercicios reutilizables','','view',null,1000,true,false),
  ('exercises.create','exercises','Biblioteca de ejercicios','Crear','','create','exercises.view',1010,true,false),
  ('exercises.edit','exercises','Biblioteca de ejercicios','Editar','','edit','exercises.view',1020,true,false),
  ('exercises.delete','exercises','Biblioteca de ejercicios','Borrar','','delete','exercises.view',1030,true,false),
  ('competition.view','competition','Competición','Ver competición','','view',null,1100,true,false),
  ('competition.sync','competition','Competición','Sincronizar competición','Reservado al owner.','sync','competition.view',1110,false,true),
  ('library.view','library','Librería','Ver documentos','','view',null,1200,true,false),
  ('library.configure','library','Librería','Configurar carpeta','Reservado al owner.','configure','library.view',1210,false,true),
  ('library.sync','library','Librería','Sincronizar documentos','Reservado al owner.','sync','library.view',1220,false,true),
  ('settings.view','settings','Ajustes','Acceder a Ajustes','Reservado al owner.','view',null,1300,false,true),
  ('settings.team','settings','Ajustes','Gestionar Equipo','Reservado al owner.','manage','settings.view',1310,false,true),
  ('settings.seasons','settings','Ajustes','Gestionar Temporadas','Reservado al owner.','manage','settings.view',1320,false,true),
  ('settings.permissions','settings','Ajustes','Gestionar Permisos','Reservado al owner.','manage','settings.view',1330,false,true),
  ('team.view','team','Equipo','Ver integrantes','Reservado al owner.','view','settings.team',1400,false,true),
  ('team.edit','team','Equipo','Editar perfiles','Reservado al owner.','edit','team.view',1410,false,true),
  ('team.private_details','team','Equipo','Ver datos privados','Reservado al owner.','view','team.view',1420,false,true),
  ('team.roles','team','Equipo','Cambiar estado y roles','Reservado al owner.','edit','team.edit',1430,false,true),
  ('team.archive','team','Equipo','Desautorizar y restaurar','Reservado al owner.','delete','team.edit',1440,false,true),
  ('team.link_guests','team','Equipo','Vincular invitadas','Reservado al owner.','edit','team.edit',1450,false,true),
  ('seasons.view','seasons','Temporadas','Ver temporadas','Reservado al owner.','view','settings.seasons',1500,false,true),
  ('seasons.create','seasons','Temporadas','Crear','Reservado al owner.','create','seasons.view',1510,false,true),
  ('seasons.edit','seasons','Temporadas','Editar','Reservado al owner.','edit','seasons.view',1520,false,true),
  ('seasons.delete','seasons','Temporadas','Borrar','Reservado al owner.','delete','seasons.view',1530,false,true),
  ('seasons.memberships','seasons','Temporadas','Gestionar vinculaciones','Reservado al owner.','edit','seasons.view',1540,false,true);

insert into public.role_permission_defaults (role, permission_key)
select role, permission_key from (
  select 'coach'::text as role, unnest(array[
    'dashboard.view_team','statistics.view','statistics.attendance','statistics.tasks','calendar.view_manage',
    'tasks.view_team','tasks.view_results','tasks.create','tasks.edit','tasks.delete','tasks.publish','tasks.reorder',
    'announcements.view','announcements.view_team','announcements.create','announcements.edit','announcements.delete','announcements.publish',
    'matches.view','matches.create','matches.edit','matches.delete','matches.availability_team','matches.availability_edit',
    'matches.lineup_view','matches.lineup_edit','matches.lineup_publish','matches.lineup_unlock','matches.report',
    'attendance.view','attendance.record','attendance.report','attendance.guests',
    'training.view','training.create','training.edit','training.delete','training.publish',
    'exercises.view','exercises.create','exercises.edit','exercises.delete','competition.view','library.view'
  ]) as permission_key
  union all
  select 'viewer', unnest(array['dashboard.view_team','statistics.view','statistics.attendance','statistics.tasks','matches.view','matches.availability_team','matches.lineup_view','attendance.report','competition.view','library.view'])
  union all
  select 'player', unnest(array['dashboard.view_personal','calendar.view_personal','tasks.view_own','tasks.submit_own','announcements.view','matches.view','matches.availability_own','matches.lineup_view','competition.view','library.view'])
) defaults;

insert into public.role_permissions (role, permission_key)
select role, permission_key from public.role_permission_defaults;

alter table public.permission_definitions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permission_defaults enable row level security;
alter table public.permission_audit_log enable row level security;

create or replace function public.current_user_has_permission(checked_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.is_approved and profile.is_active and not profile.is_archived
      and (
        profile.is_owner
        or exists (
          select 1 from public.role_permissions grant_row
          join public.permission_definitions definition on definition.key = grant_row.permission_key and definition.active
          where grant_row.permission_key = checked_permission and grant_row.enabled
            and ((grant_row.role = 'coach' and profile.is_coach)
              or (grant_row.role = 'viewer' and profile.is_viewer)
              or (grant_row.role = 'player' and profile.is_player))
        )
      )
  );
$$;

create or replace function public.get_my_permissions()
returns setof text language sql stable security definer set search_path = '' as $$
  select definition.key
  from public.permission_definitions definition
  where definition.active and public.current_user_has_permission(definition.key)
  order by definition.sort_order;
$$;

create policy "Owners can read permission definitions" on public.permission_definitions for select to authenticated
using ((select public.current_user_is_owner()));
create policy "Owners can read role permissions" on public.role_permissions for select to authenticated
using ((select public.current_user_is_owner()));
create policy "Owners can read permission defaults" on public.role_permission_defaults for select to authenticated
using ((select public.current_user_is_owner()));
create policy "Owners can read permission audit" on public.permission_audit_log for select to authenticated
using ((select public.current_user_is_owner()));

create or replace function public.set_role_permissions(checked_role text, checked_permissions text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous_value jsonb;
begin
  if not public.current_user_is_owner() then raise exception 'Solo el owner puede modificar permisos'; end if;
  if checked_role not in ('coach', 'viewer', 'player') then raise exception 'Rol no válido'; end if;
  if exists (
    select 1 from unnest(coalesce(checked_permissions, array[]::text[])) requested(key)
    left join public.permission_definitions definition on definition.key = requested.key
    where definition.key is null or not definition.active or not definition.configurable or definition.owner_only
  ) then raise exception 'La selección contiene permisos no configurables'; end if;
  if exists (
    select 1 from unnest(coalesce(checked_permissions, array[]::text[])) requested(key)
    join public.permission_definitions definition on definition.key = requested.key
    where definition.parent_key is not null and not (definition.parent_key = any(coalesce(checked_permissions, array[]::text[])))
  ) then raise exception 'Un permiso requiere activar antes su permiso padre'; end if;

  select coalesce(jsonb_agg(permission_key order by permission_key), '[]'::jsonb) into previous_value
  from public.role_permissions where role = checked_role and enabled;
  delete from public.role_permissions where role = checked_role;
  insert into public.role_permissions (role, permission_key, updated_by)
  select checked_role, requested.key, (select auth.uid())
  from (select distinct unnest(coalesce(checked_permissions, array[]::text[])) as key) requested;
  insert into public.permission_audit_log (role, previous_permissions, new_permissions, changed_by)
  values (checked_role, previous_value, to_jsonb(coalesce(checked_permissions, array[]::text[])), (select auth.uid()));
end;
$$;

create or replace function public.reset_role_permissions(checked_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare default_permissions text[];
begin
  select coalesce(array_agg(permission_key), array[]::text[]) into default_permissions
  from public.role_permission_defaults where role = checked_role;
  perform public.set_role_permissions(checked_role, default_permissions);
end;
$$;

-- Compatibilidad temporal: las políticas existentes pasan por la nueva autoridad central.
create or replace function public.current_user_can_manage_sport()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_permission('calendar.view_manage')
    or public.current_user_has_permission('attendance.record')
    or public.current_user_has_permission('training.create')
    or public.current_user_has_permission('training.edit')
    or public.current_user_has_permission('training.delete');
$$;
create or replace function public.current_user_can_view_team_data()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_permission('dashboard.view_team') or public.current_user_has_permission('statistics.view');
$$;
create or replace function public.current_user_can_manage_tasks()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_permission('tasks.view_team');
$$;

-- La compatibilidad deportiva es más amplia para las RPC antiguas, pero los
-- cumpleaños con edad continúan ligados exclusivamente al calendario de gestión.
create or replace function public.get_active_season_birthdays()
returns table (season_id uuid, player_id uuid, display_name text, birthday_on date, age_turning integer)
language plpgsql stable security definer set search_path = '' as $$
declare today_in_madrid date := (pg_catalog.now() at time zone 'Europe/Madrid')::date;
begin
  if not public.current_user_has_permission('calendar.view_manage') then
    raise exception 'No tienes permiso para consultar los cumpleaños de la temporada';
  end if;
  return query
  with active_season as (
    select season.id, season.start_date, season.end_date from public.seasons season
    where today_in_madrid between season.start_date and season.end_date
    order by season.start_date desc limit 1
  ), occurrences as (
    select season.id as season_id, profile.id as player_id, profile.display_name, details.birth_date,
      pg_catalog.make_date(season_year, extract(month from details.birth_date)::integer,
        least(extract(day from details.birth_date)::integer, extract(day from (
          pg_catalog.make_date(season_year, extract(month from details.birth_date)::integer, 1) + interval '1 month - 1 day'
        ))::integer)) as birthday_on
    from active_season season
    cross join lateral pg_catalog.generate_series(extract(year from season.start_date)::integer, extract(year from season.end_date)::integer) as season_year
    join public.season_players membership on membership.season_id = season.id
    join public.profiles profile on profile.id = membership.player_id
    join public.profile_private_details details on details.profile_id = profile.id
    where profile.is_player and profile.is_approved and profile.is_active and not profile.is_archived and details.birth_date is not null
  )
  select distinct occurrence.season_id, occurrence.player_id, occurrence.display_name, occurrence.birthday_on,
    extract(year from occurrence.birthday_on)::integer - extract(year from occurrence.birth_date)::integer
  from occurrences occurrence
  join active_season season on season.id = occurrence.season_id
  join public.season_players membership on membership.season_id = occurrence.season_id and membership.player_id = occurrence.player_id
  where occurrence.birthday_on between season.start_date and season.end_date
    and occurrence.birthday_on >= membership.active_from
    and (membership.active_until is null or occurrence.birthday_on <= membership.active_until)
  order by occurrence.birthday_on, occurrence.display_name;
end;
$$;

create or replace function public.current_user_can_manage_content_images()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_permission('tasks.create')
    or public.current_user_has_permission('tasks.edit')
    or public.current_user_has_permission('announcements.create')
    or public.current_user_has_permission('announcements.edit')
    or public.current_user_has_permission('training.create')
    or public.current_user_has_permission('training.edit')
    or public.current_user_has_permission('exercises.create')
    or public.current_user_has_permission('exercises.edit');
$$;

create or replace function public.current_user_can_read_content_image(checked_image_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.content_image_references reference
    where reference.image_id = checked_image_id and (
      (reference.entity_type = 'task' and (
        public.current_user_has_permission('tasks.view_team') or public.current_user_has_permission('statistics.tasks')
        or (public.current_user_has_permission('tasks.view_own') and public.current_user_is_active_player() and exists (
          select 1 from public.tasks task join public.season_players membership
            on membership.season_id = task.season_id and membership.player_id = (select auth.uid())
          where task.id = reference.entity_id and task.status = 'published'
            and task.week_start + 6 >= membership.active_from
            and (membership.active_until is null or task.week_start <= membership.active_until)
        ))
      ))
      or (reference.entity_type = 'announcement' and (
        public.current_user_has_permission('announcements.view_team')
        or (public.current_user_has_permission('announcements.view') and public.current_user_is_active_player() and exists (
          select 1 from public.team_announcements announcement join public.season_players membership
            on membership.season_id = announcement.season_id and membership.player_id = (select auth.uid())
          where announcement.id = reference.entity_id and announcement.status = 'published'
            and announcement.announcement_date >= membership.active_from
            and (membership.active_until is null or announcement.announcement_date <= membership.active_until)
        ))
      ))
      or (reference.entity_type = 'training_plan' and public.current_user_has_permission('training.view'))
      or (reference.entity_type = 'training_preset' and public.current_user_has_permission('exercises.view'))
    )
  );
$$;

-- Las políticas por tabla aplican la capacidad concreta. Los triggers también
-- protegen las escrituras realizadas desde RPC security definer.
drop policy if exists "Players can read their published tasks" on public.tasks;
create policy "Players can read their published tasks" on public.tasks for select to authenticated using (
  (select public.current_user_has_permission('tasks.view_team'))
  or (select public.current_user_has_permission('statistics.tasks'))
  or (
    status = 'published' and (select public.current_user_has_permission('tasks.view_own'))
    and (select public.current_user_is_active_player())
    and exists (select 1 from public.season_players membership
      where membership.season_id = tasks.season_id and membership.player_id = (select auth.uid())
        and tasks.week_start + 6 >= membership.active_from
        and (membership.active_until is null or tasks.week_start <= membership.active_until))
  )
);
drop policy if exists "Task managers can read all results" on public.task_results;
create policy "Task managers can read all results" on public.task_results for select to authenticated using (
  (select public.current_user_has_permission('tasks.view_results')) or (select public.current_user_has_permission('statistics.tasks'))
);
drop policy if exists "Task managers can read profiles" on public.profiles;
create policy "Task managers can read profiles" on public.profiles for select to authenticated using (
  (select public.current_user_has_permission('tasks.view_results')) or (select public.current_user_has_permission('statistics.view'))
);
drop policy if exists "Sport managers can create tasks" on public.tasks;
drop policy if exists "Sport managers can update tasks" on public.tasks;
drop policy if exists "Sport managers can delete tasks" on public.tasks;
create policy "Sport managers can create tasks" on public.tasks for insert to authenticated
with check ((select public.current_user_has_permission('tasks.create')) and created_by = (select auth.uid()));
create policy "Sport managers can update tasks" on public.tasks for update to authenticated
using ((select public.current_user_has_permission('tasks.edit'))) with check ((select public.current_user_has_permission('tasks.edit')));
create policy "Sport managers can delete tasks" on public.tasks for delete to authenticated
using ((select public.current_user_has_permission('tasks.delete')));

drop policy if exists "Players and sport managers can read announcements" on public.team_announcements;
drop policy if exists "Sport managers can create announcements" on public.team_announcements;
drop policy if exists "Sport managers can update announcements" on public.team_announcements;
drop policy if exists "Sport managers can delete announcements" on public.team_announcements;
create policy "Players and sport managers can read announcements" on public.team_announcements for select to authenticated using (
  (select public.current_user_has_permission('announcements.view_team'))
  or (
    status = 'published' and (select public.current_user_has_permission('announcements.view'))
    and (select public.current_user_is_active_player())
    and exists (select 1 from public.season_players membership
      where membership.season_id = team_announcements.season_id and membership.player_id = (select auth.uid())
        and team_announcements.announcement_date >= membership.active_from
        and (membership.active_until is null or team_announcements.announcement_date <= membership.active_until))
  )
);
create policy "Sport managers can create announcements" on public.team_announcements for insert to authenticated
with check ((select public.current_user_has_permission('announcements.create')) and created_by = (select auth.uid()));
create policy "Sport managers can update announcements" on public.team_announcements for update to authenticated
using ((select public.current_user_has_permission('announcements.edit'))) with check ((select public.current_user_has_permission('announcements.edit')));
create policy "Sport managers can delete announcements" on public.team_announcements for delete to authenticated
using ((select public.current_user_has_permission('announcements.delete')));

drop policy if exists "Staff and players can read matches" on public.matches;
drop policy if exists "Sport managers can create matches" on public.matches;
drop policy if exists "Sport managers can update matches" on public.matches;
drop policy if exists "Sport managers can delete matches" on public.matches;
create policy "Staff and players can read matches" on public.matches for select to authenticated using (
  (select public.current_user_has_permission('matches.view')) and (
    (select public.current_user_has_permission('matches.edit')) or status <> 'draft'
    or public.player_can_access_match(id, (select auth.uid()))
  )
);
create policy "Sport managers can create matches" on public.matches for insert to authenticated
with check ((select public.current_user_has_permission('matches.create')) and created_by = (select auth.uid()));
create policy "Sport managers can update matches" on public.matches for update to authenticated
using ((select public.current_user_has_permission('matches.edit'))) with check ((select public.current_user_has_permission('matches.edit')));
create policy "Sport managers can delete matches" on public.matches for delete to authenticated
using ((select public.current_user_has_permission('matches.delete')));

drop policy if exists "Players and staff can read availability" on public.match_availability;
create policy "Players and staff can read availability" on public.match_availability for select to authenticated using (
  ((player_id = (select auth.uid())) and (select public.current_user_has_permission('matches.availability_own')))
  or (select public.current_user_has_permission('matches.availability_team'))
);
drop policy if exists "Staff and selected players can read lineups" on public.match_lineup;
create policy "Staff and selected players can read lineups" on public.match_lineup for select to authenticated using (
  (select public.current_user_has_permission('matches.lineup_edit'))
  or ((select public.current_user_has_permission('matches.lineup_view')) and exists (
    select 1 from public.matches match where match.id = match_id and match.lineup_published
      and ((select public.current_user_has_permission('matches.availability_team')) or public.player_can_access_match(match_id, (select auth.uid())))
  ))
);

drop policy if exists "Team staff can read training sessions" on public.training_sessions;
create policy "Team staff can read training sessions" on public.training_sessions for select to authenticated using (
  (select public.current_user_has_permission('attendance.view')) or (select public.current_user_has_permission('attendance.report'))
  or (select public.current_user_has_permission('statistics.attendance'))
);
drop policy if exists "Players and staff can read attendance" on public.training_attendance;
create policy "Players and staff can read attendance" on public.training_attendance for select to authenticated using (
  player_id = (select auth.uid()) or (select public.current_user_has_permission('attendance.view')) or (select public.current_user_has_permission('attendance.report'))
  or (select public.current_user_has_permission('statistics.attendance'))
);
drop policy if exists "Team staff can read provisional players" on public.provisional_players;
create policy "Team staff can read provisional players" on public.provisional_players for select to authenticated using (
  (select public.current_user_has_permission('attendance.guests')) or (select public.current_user_has_permission('attendance.report'))
  or (select public.current_user_has_permission('statistics.attendance')) or (select public.current_user_has_permission('settings.team'))
);
drop policy if exists "Team staff can read provisional attendance" on public.provisional_training_attendance;
create policy "Team staff can read provisional attendance" on public.provisional_training_attendance for select to authenticated using (
  (select public.current_user_has_permission('attendance.guests')) or (select public.current_user_has_permission('attendance.report'))
  or (select public.current_user_has_permission('statistics.attendance')) or (select public.current_user_has_permission('settings.team'))
);

drop policy if exists "Sport managers can read training plans" on public.training_plans;
drop policy if exists "Sport managers can create training plans" on public.training_plans;
drop policy if exists "Sport managers can update training plans" on public.training_plans;
drop policy if exists "Sport managers can delete training plans" on public.training_plans;
create policy "Sport managers can read training plans" on public.training_plans for select to authenticated using ((select public.current_user_has_permission('training.view')));
create policy "Sport managers can create training plans" on public.training_plans for insert to authenticated with check ((select public.current_user_has_permission('training.create')) and created_by = (select auth.uid()));
create policy "Sport managers can update training plans" on public.training_plans for update to authenticated using ((select public.current_user_has_permission('training.edit'))) with check ((select public.current_user_has_permission('training.edit')));
create policy "Sport managers can delete training plans" on public.training_plans for delete to authenticated using ((select public.current_user_has_permission('training.delete')));

drop policy if exists "Sport managers can read training exercises" on public.training_exercises;
drop policy if exists "Sport managers can create training exercises" on public.training_exercises;
drop policy if exists "Sport managers can update training exercises" on public.training_exercises;
drop policy if exists "Sport managers can delete training exercises" on public.training_exercises;
create policy "Sport managers can read training exercises" on public.training_exercises for select to authenticated using ((select public.current_user_has_permission('training.view')));
create policy "Sport managers can create training exercises" on public.training_exercises for insert to authenticated with check ((select public.current_user_has_permission('training.create')));
create policy "Sport managers can update training exercises" on public.training_exercises for update to authenticated using ((select public.current_user_has_permission('training.edit'))) with check ((select public.current_user_has_permission('training.edit')));
create policy "Sport managers can delete training exercises" on public.training_exercises for delete to authenticated using ((select public.current_user_has_permission('training.edit')));

drop policy if exists "Sport managers can read training exercise presets" on public.training_exercise_presets;
drop policy if exists "Sport managers can create training exercise presets" on public.training_exercise_presets;
drop policy if exists "Sport managers can update training exercise presets" on public.training_exercise_presets;
drop policy if exists "Sport managers can delete training exercise presets" on public.training_exercise_presets;
create policy "Sport managers can read training exercise presets" on public.training_exercise_presets for select to authenticated using ((select public.current_user_has_permission('exercises.view')));
create policy "Sport managers can create training exercise presets" on public.training_exercise_presets for insert to authenticated with check ((select public.current_user_has_permission('exercises.create')) and created_by = (select auth.uid()));
create policy "Sport managers can update training exercise presets" on public.training_exercise_presets for update to authenticated using ((select public.current_user_has_permission('exercises.edit'))) with check ((select public.current_user_has_permission('exercises.edit')));
create policy "Sport managers can delete training exercise presets" on public.training_exercise_presets for delete to authenticated using ((select public.current_user_has_permission('exercises.delete')));

create or replace function public.enforce_configurable_permission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare required_permission text;
begin
  required_permission := case tg_table_name
    when 'tasks' then case tg_op when 'INSERT' then 'tasks.create' when 'UPDATE' then 'tasks.edit' else 'tasks.delete' end
    when 'team_announcements' then case tg_op when 'INSERT' then 'announcements.create' when 'UPDATE' then 'announcements.edit' else 'announcements.delete' end
    when 'matches' then case tg_op when 'INSERT' then 'matches.create' when 'UPDATE' then 'matches.edit' else 'matches.delete' end
    when 'training_sessions' then 'attendance.record'
    when 'training_attendance' then 'attendance.record'
    when 'provisional_training_attendance' then 'attendance.guests'
    when 'provisional_players' then 'attendance.guests'
    when 'training_plans' then case tg_op when 'INSERT' then 'training.create' when 'UPDATE' then 'training.edit' else 'training.delete' end
    when 'training_exercises' then case tg_op when 'INSERT' then 'training.create' when 'UPDATE' then 'training.edit' else null end
    when 'training_exercise_presets' then case tg_op when 'INSERT' then 'exercises.create' when 'UPDATE' then 'exercises.edit' else 'exercises.delete' end
    when 'match_lineup' then 'matches.lineup_edit'
    when 'match_availability' then case when new.player_id = (select auth.uid()) then 'matches.availability_own' else 'matches.availability_edit' end
    when 'task_results' then 'tasks.submit_own'
    else null
  end;
  if required_permission is not null and not public.current_user_has_permission(required_permission) then
    raise exception 'No tienes el permiso necesario: %', required_permission;
  end if;
  if tg_table_name = 'tasks' and tg_op = 'UPDATE' and new.status is distinct from old.status
    and not public.current_user_has_permission('tasks.publish') then raise exception 'No tienes permiso para publicar tareas'; end if;
  if tg_table_name = 'tasks' and tg_op = 'INSERT' and new.status <> 'draft'
    and not public.current_user_has_permission('tasks.publish') then raise exception 'No tienes permiso para publicar tareas'; end if;
  if tg_table_name = 'team_announcements' and tg_op = 'UPDATE' and new.status is distinct from old.status
    and not public.current_user_has_permission('announcements.publish') then raise exception 'No tienes permiso para publicar avisos'; end if;
  if tg_table_name = 'team_announcements' and tg_op = 'INSERT' and new.status <> 'draft'
    and not public.current_user_has_permission('announcements.publish') then raise exception 'No tienes permiso para publicar avisos'; end if;
  if tg_table_name = 'training_plans' and tg_op = 'UPDATE' and new.status is distinct from old.status
    and not public.current_user_has_permission('training.publish') then raise exception 'No tienes permiso para publicar entrenamientos'; end if;
  if tg_table_name = 'training_plans' and tg_op = 'INSERT' and new.status <> 'draft'
    and not public.current_user_has_permission('training.publish') then raise exception 'No tienes permiso para publicar entrenamientos'; end if;
  if tg_table_name = 'training_exercises' and tg_op = 'DELETE'
    and not (public.current_user_has_permission('training.edit') or public.current_user_has_permission('training.delete')) then
    raise exception 'No tienes permiso para eliminar ejercicios del entrenamiento';
  end if;
  if tg_table_name = 'matches' and tg_op = 'UPDATE' and new.lineup_published is distinct from old.lineup_published then
    if new.lineup_published and not public.current_user_has_permission('matches.lineup_publish') then raise exception 'No tienes permiso para publicar convocatorias'; end if;
    if not new.lineup_published and not public.current_user_has_permission('matches.lineup_unlock') then raise exception 'No tienes permiso para desbloquear convocatorias'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['tasks','task_results','team_announcements','matches','match_availability','training_sessions','training_attendance','provisional_training_attendance','provisional_players','training_plans','training_exercises','training_exercise_presets','match_lineup'] loop
    execute format('drop trigger if exists enforce_configurable_permission on public.%I', table_name);
    execute format('create trigger enforce_configurable_permission before insert or update or delete on public.%I for each row execute function public.enforce_configurable_permission()', table_name);
  end loop;
end $$;

drop policy if exists "Sport managers can create content image metadata" on public.content_images;
create policy "Sport managers can create content image metadata" on public.content_images for insert to authenticated with check (
  (select public.current_user_can_manage_content_images()) and created_by = (select auth.uid())
  and storage_path = created_by::text || '/' || id::text || '.webp'
);
drop policy if exists "Sport managers can read content image references" on public.content_image_references;
create policy "Sport managers can read content image references" on public.content_image_references for select to authenticated
using ((select public.current_user_can_manage_content_images()));
drop policy if exists "Sport managers can upload private content images" on storage.objects;
create policy "Sport managers can upload private content images" on storage.objects for insert to authenticated with check (
  bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.current_user_can_manage_content_images())
);
drop policy if exists "Sport managers can delete private content images" on storage.objects;
create policy "Sport managers can delete private content images" on storage.objects for delete to authenticated using (
  bucket_id = 'content-images' and (select public.current_user_can_manage_content_images())
);

create or replace function public.cleanup_content_images(checked_image_ids uuid[])
returns table (storage_path text) language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_can_manage_content_images() then raise exception 'No tienes permiso para eliminar imágenes'; end if;
  return query delete from public.content_images image
    where image.id = any(coalesce(checked_image_ids, '{}'::uuid[]))
      and image.created_by = (select auth.uid())
      and not exists (select 1 from public.content_image_references reference where reference.image_id = image.id)
    returning image.storage_path;
end;
$$;

create or replace function public.cleanup_my_abandoned_content_images()
returns table (storage_path text) language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_can_manage_content_images() then raise exception 'No tienes permiso para eliminar imágenes'; end if;
  return query delete from public.content_images image
    where image.created_by = (select auth.uid()) and image.created_at < now() - interval '24 hours'
      and not exists (select 1 from public.content_image_references reference where reference.image_id = image.id)
    returning image.storage_path;
end;
$$;

revoke all on function public.current_user_has_permission(text) from public;
revoke all on function public.get_my_permissions() from public;
revoke all on function public.set_role_permissions(text,text[]) from public;
revoke all on function public.reset_role_permissions(text) from public;
grant execute on function public.current_user_has_permission(text) to authenticated;
grant execute on function public.get_my_permissions() to authenticated;
grant execute on function public.set_role_permissions(text,text[]) to authenticated;
grant execute on function public.reset_role_permissions(text) to authenticated;
revoke all on function public.current_user_can_manage_content_images() from public;
revoke all on function public.enforce_configurable_permission() from public;
grant execute on function public.current_user_can_manage_content_images() to authenticated;

revoke all on public.permission_definitions, public.role_permissions, public.role_permission_defaults, public.permission_audit_log from anon;
grant select on public.permission_definitions, public.role_permissions, public.role_permission_defaults, public.permission_audit_log to authenticated;
