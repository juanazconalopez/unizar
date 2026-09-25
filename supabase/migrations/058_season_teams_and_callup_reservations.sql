-- Equipos por temporada. season_players sigue siendo el historial de pertenencia;
-- el equipo es la preferencia actual dentro de ese periodo, no un segundo listado.

insert into public.permission_definitions (
  key, section_key, section_label, label, description, action,
  parent_key, sort_order, configurable, owner_only
) values (
  'seasons.teams', 'seasons', 'Temporadas', 'Gestionar equipos',
  'Crear equipos de temporada y asignar jugadoras y entrenadores.', 'manage',
  'seasons.view', 1560, false, true
) on conflict (key) do nothing;

create table if not exists public.season_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  is_mixed boolean not null default false,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, season_id)
);

create unique index if not exists season_teams_name_idx on public.season_teams (season_id, lower(trim(name)));
create unique index if not exists season_teams_one_mixed_idx on public.season_teams (season_id) where is_mixed;
create unique index if not exists season_teams_one_default_idx on public.season_teams (season_id) where is_default;
create index if not exists season_teams_season_idx on public.season_teams (season_id, is_active, created_at, id);

create table if not exists public.season_team_coaches (
  season_team_id uuid not null references public.season_teams(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_team_id, coach_id)
);

create index if not exists season_team_coaches_coach_idx on public.season_team_coaches (coach_id, season_team_id);

alter table public.season_players add column if not exists season_team_id uuid;
alter table public.matches add column if not exists team_id uuid;

create or replace function public.create_default_season_team()
returns trigger language plpgsql security definer set search_path = '' as $$
declare default_team_id uuid;
begin
  insert into public.season_teams (season_id, name, is_default, created_by)
  values (new.id, 'Unizar Femenino', true, new.created_by)
  returning id into default_team_id;

  -- Una temporada nueva empieza con todas las jugadoras activas. Las bajas de
  -- la temporada anterior no se trasladan: se gestionan como ausencia, no como
  -- salida de plantilla.
  insert into public.season_players (season_id, player_id, active_from, active_until, season_team_id)
  select new.id, profile.id, new.start_date, null, default_team_id
  from public.profiles profile
  where profile.is_player and profile.is_approved and profile.is_active and not profile.is_archived
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists seasons_create_default_team on public.seasons;
create trigger seasons_create_default_team
after insert on public.seasons
for each row execute function public.create_default_season_team();

-- Todas las temporadas existentes se migran a un único equipo inicial. No se
-- toca el periodo histórico de ninguna vinculación.
insert into public.season_teams (season_id, name, is_default, created_by)
select season.id, 'Unizar Femenino', true, season.created_by
from public.seasons season
where not exists (select 1 from public.season_teams team where team.season_id = season.id);

update public.season_players membership
set season_team_id = team.id
from public.season_teams team
where team.season_id = membership.season_id
  and team.is_default
  and membership.season_team_id is null;

alter table public.season_players alter column season_team_id set not null;
do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.season_players'::regclass and conname = 'season_players_team_season_fkey') then
    execute 'alter table public.season_players add constraint season_players_team_season_fkey foreign key (season_team_id, season_id) references public.season_teams(id, season_id) on delete restrict';
  end if;
end;
$$;
create index if not exists season_players_team_idx on public.season_players (season_team_id, player_id, active_from);

-- En el SQL Editor no hay auth.uid(); el trigger de permisos de la app
-- rechazaría este backfill histórico. Se suspende solo durante esta sentencia.
-- El bloque DO es atómico: ante un error, PostgreSQL revierte también el
-- DISABLE TRIGGER y no deja la tabla sin protección.
do $$
begin
  execute 'alter table public.matches disable trigger enforce_configurable_permission';
  update public.matches match
  set team_id = team.id
  from public.season_teams team
  where match.match_kind = 'official'::public.match_kind
    and team.season_id = match.season_id
    and team.is_default
    and match.team_id is null;
  execute 'alter table public.matches enable trigger enforce_configurable_permission';
end;
$$;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.matches'::regclass and conname = 'matches_team_season_fkey') then
    execute 'alter table public.matches add constraint matches_team_season_fkey foreign key (team_id, season_id) references public.season_teams(id, season_id) on delete restrict';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.matches'::regclass and conname = 'matches_kind_team_check') then
    execute $sql$alter table public.matches add constraint matches_kind_team_check check (
      (match_kind = 'official'::public.match_kind and team_id is not null)
      or match_kind = 'friendly'::public.match_kind
    )$sql$;
  end if;
end;
$$;
create index if not exists matches_team_date_idx on public.matches (team_id, match_date);

drop trigger if exists season_teams_set_updated_at on public.season_teams;
create trigger season_teams_set_updated_at before update on public.season_teams
for each row execute function public.set_updated_at();

alter table public.season_teams enable row level security;
alter table public.season_team_coaches enable row level security;

create or replace function public.current_user_can_manage_season_team(checked_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_is_owner() or exists (
    select 1 from public.season_team_coaches assignment
    join public.profiles coach on coach.id = assignment.coach_id
    where assignment.season_team_id = checked_team_id
      and assignment.coach_id = (select auth.uid())
      and coach.is_coach and coach.is_approved and coach.is_active and not coach.is_archived
  );
$$;

create or replace function public.current_user_can_view_season_team(checked_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_can_manage_season_team(checked_team_id) or exists (
    select 1
    from public.season_teams mixed
    join public.season_teams assigned on assigned.season_id = mixed.season_id
    join public.season_team_coaches assignment on assignment.season_team_id = assigned.id
    where mixed.id = checked_team_id and mixed.is_mixed
      and assignment.coach_id = (select auth.uid())
  );
$$;

drop policy if exists "Approved users can read season teams" on public.season_teams;
create policy "Approved users can read season teams" on public.season_teams for select to authenticated
using ((select public.current_user_is_approved()));
drop policy if exists "Owners can read team assignments" on public.season_team_coaches;
create policy "Owners can read team assignments" on public.season_team_coaches for select to authenticated
using ((select public.current_user_is_owner()) or coach_id = (select auth.uid()));

grant select on table public.season_teams, public.season_team_coaches to authenticated;
revoke insert, update, delete on table public.season_teams, public.season_team_coaches from authenticated;

create or replace function public.create_season_team(checked_season_id uuid, checked_name text, checked_is_mixed boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_team_id uuid;
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede gestionar los equipos de la temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para el equipo';
  end if;
  perform 1 from public.seasons where id = checked_season_id for update;
  if not found then raise exception 'La temporada no existe'; end if;

  insert into public.season_teams (season_id, name, is_mixed, created_by)
  values (checked_season_id, trim(checked_name), coalesce(checked_is_mixed, false), (select auth.uid()))
  returning id into created_team_id;
  return created_team_id;
end;
$$;

create or replace function public.update_season_team(checked_team_id uuid, checked_name text, checked_is_mixed boolean, checked_is_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede gestionar los equipos de la temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para el equipo';
  end if;
  if checked_is_active = false and exists (
    select 1 from public.season_players where season_team_id = checked_team_id and active_until is null
  ) then
    raise exception 'Reasigna primero a las jugadoras activas de este equipo';
  end if;
  update public.season_teams
  set name = trim(checked_name), is_mixed = coalesce(checked_is_mixed, false), is_active = coalesce(checked_is_active, true)
  where id = checked_team_id;
  if not found then raise exception 'El equipo no existe'; end if;
end;
$$;

create or replace function public.delete_season_team(checked_team_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede gestionar los equipos de la temporada';
  end if;
  if exists (select 1 from public.season_teams where id = checked_team_id and is_default) then
    raise exception 'El equipo inicial se puede renombrar o desactivar, pero no borrar';
  end if;
  if exists (select 1 from public.matches where team_id = checked_team_id) then
    raise exception 'No se puede borrar un equipo que tiene partidos asociados';
  end if;
  if exists (select 1 from public.season_players where season_team_id = checked_team_id) then
    raise exception 'Reasigna primero a todas las jugadoras de este equipo';
  end if;
  delete from public.season_teams where id = checked_team_id;
  if not found then raise exception 'El equipo no existe'; end if;
end;
$$;

create or replace function public.assign_season_player_team(checked_season_id uuid, checked_player_id uuid, checked_team_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede asignar jugadoras a equipos';
  end if;
  if not exists (
    select 1 from public.season_teams
    where id = checked_team_id and season_id = checked_season_id and is_active
  ) then raise exception 'El equipo seleccionado no está activo en esta temporada'; end if;
  update public.season_players
  set season_team_id = checked_team_id
  where season_id = checked_season_id and player_id = checked_player_id and active_until is null;
  if not found then raise exception 'La jugadora no pertenece actualmente a esta temporada'; end if;
end;
$$;

create or replace function public.set_season_team_coach(checked_team_id uuid, checked_coach_id uuid, checked_assigned boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede asignar entrenadores a equipos';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = checked_coach_id and is_coach and is_approved and is_active and not is_archived
  ) then raise exception 'La persona seleccionada no es un entrenador activo'; end if;
  if checked_assigned then
    insert into public.season_team_coaches (season_team_id, coach_id)
    values (checked_team_id, checked_coach_id) on conflict do nothing;
  else
    delete from public.season_team_coaches where season_team_id = checked_team_id and coach_id = checked_coach_id;
  end if;
end;
$$;

-- Al aprobar una jugadora durante una temporada se mantiene la asignación
-- automática, ahora al equipo inicial de esa temporada.
create or replace function public.assign_active_season_on_player_authorization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_approved and new.is_active and new.is_player and not new.is_archived
    and (not old.is_approved or not old.is_active or not old.is_player or old.is_archived)
  then
    insert into public.season_players (season_id, player_id, active_from, active_until, season_team_id)
    select season.id, new.id, current_date, null, team.id
    from public.seasons season
    join public.season_teams team on team.season_id = season.id and team.is_default
    where season.start_date <= current_date and season.end_date >= current_date
      and not exists (
        select 1 from public.season_players membership
        where membership.season_id = season.id and membership.player_id = new.id and membership.active_until is null
      )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Los entrenadores existentes conservan el acceso a los equipos migrados. Los
-- equipos que se creen después se asignan explícitamente desde Ajustes.
insert into public.season_team_coaches (season_team_id, coach_id)
select team.id, coach.id
from public.season_teams team
join public.profiles coach on coach.is_coach and coach.is_approved and coach.is_active and not coach.is_archived
on conflict do nothing;

-- Un entrenador solo gestiona partidos de un equipo al que esté asignado. El
-- owner conserva el control completo y un amistoso usa team_id como organizador.
create or replace function public.current_user_can_edit_match(checked_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches match
    where match.id = checked_match_id
      and (public.current_user_is_owner() or public.current_user_can_manage_season_team(match.team_id))
  );
$$;

create or replace function public.save_match_lineup(
  checked_match_id uuid,
  lineup_entries jsonb,
  publish_lineup boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare maximum_slots integer;
declare starter_slots integer;
declare was_published boolean;
declare checked_date date;
begin
  if not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permiso para gestionar esta convocatoria';
  end if;

  select case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end, lineup_published, match_date
  into maximum_slots, starter_slots, was_published, checked_date
  from public.matches where id = checked_match_id for update;
  if not found then raise exception 'El partido no existe'; end if;
  if was_published then raise exception 'La convocatoria publicada ya no se puede modificar'; end if;

  -- Bloquea todos los partidos de la fecha durante esta comprobación, para que
  -- dos responsables no puedan reservar a la misma jugadora a la vez.
  perform 1 from public.matches where match_date = checked_date order by id for update;
  if exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    where coalesce((entry->>'slot_number')::smallint, 0) not between 1 and maximum_slots
  ) then raise exception 'El dorsal no es válido para este tipo de partido'; end if;
  if exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    left join public.matches match on match.id = checked_match_id
    left join public.season_players membership on membership.season_id = match.season_id
      and membership.player_id = (entry->>'player_id')::uuid
      and membership.active_from <= match.match_date
      and (membership.active_until is null or membership.active_until >= match.match_date)
    left join public.profiles player on player.id = (entry->>'player_id')::uuid
    left join public.match_availability availability on availability.match_id = checked_match_id
      and availability.player_id = (entry->>'player_id')::uuid and availability.status = 'available'::public.availability_status
    where membership.id is null or player.id is null or availability.player_id is null
      or not player.is_approved or not player.is_active or player.is_archived or not player.is_player
  ) then raise exception 'La convocatoria contiene una jugadora que no está disponible'; end if;
  if exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    join public.match_lineup other_lineup on other_lineup.player_id = (entry->>'player_id')::uuid
    join public.matches other_match on other_match.id = other_lineup.match_id
    where other_match.match_date = checked_date and other_match.id <> checked_match_id
  ) then raise exception 'Una jugadora ya está reservada en la convocatoria de otro partido del mismo día'; end if;

  delete from public.match_lineup where match_id = checked_match_id;
  insert into public.match_lineup (match_id, player_id, role, position, slot_number, sort_order)
  select checked_match_id, (entry->>'player_id')::uuid,
    case when (entry->>'slot_number')::smallint <= starter_slots then 'starter'::public.lineup_role else 'substitute'::public.lineup_role end,
    null, (entry->>'slot_number')::smallint, (entry->>'slot_number')::smallint
  from jsonb_array_elements(lineup_entries) entries(entry);
  update public.matches set lineup_published = publish_lineup where id = checked_match_id;
end;
$$;

create or replace function public.set_player_match_availability(
  checked_match_id uuid,
  checked_player_id uuid,
  checked_status public.availability_status,
  checked_comment text
)
returns void language plpgsql security definer set search_path = '' as $$
declare normalized_comment text := nullif(trim(coalesce(checked_comment, '')), '');
declare is_lineup_published boolean;
begin
  if not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permiso para modificar la disponibilidad de este partido';
  end if;
  if length(coalesce(normalized_comment, '')) > 500 then raise exception 'El comentario no puede superar los 500 caracteres'; end if;
  select lineup_published into is_lineup_published from public.matches where id = checked_match_id and status = 'published'::public.match_status;
  if not found then raise exception 'El partido no está disponible para registrar respuestas'; end if;
  if is_lineup_published then raise exception 'Desbloquea la convocatoria antes de modificar disponibilidades'; end if;
  if not public.player_can_access_match(checked_match_id, checked_player_id) then raise exception 'La jugadora no pertenece a la temporada de este partido'; end if;
  insert into public.match_availability (match_id, player_id, status, comment)
  values (checked_match_id, checked_player_id, checked_status, normalized_comment)
  on conflict (match_id, player_id) do update set status = excluded.status, comment = excluded.comment;
  insert into public.match_availability_coach_changes (match_id, player_id, changed_by, status, comment)
  values (checked_match_id, checked_player_id, (select auth.uid()), checked_status, normalized_comment);
end;
$$;

-- Las políticas anteriores daban a cualquier entrenador acceso a toda la
-- plantilla. Desde aquí su ámbito depende del equipo asignado.
drop policy if exists "Staff and players can read matches" on public.matches;
drop policy if exists "Sport managers can create matches" on public.matches;
drop policy if exists "Sport managers can update matches" on public.matches;
drop policy if exists "Sport managers can delete matches" on public.matches;
drop policy if exists "Scoped staff and players can read matches" on public.matches;
drop policy if exists "Scoped staff can create matches" on public.matches;
drop policy if exists "Scoped staff can update matches" on public.matches;
drop policy if exists "Scoped staff can delete matches" on public.matches;
create policy "Scoped staff and players can read matches" on public.matches for select to authenticated using (
  (select public.current_user_is_owner())
  or (exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_coach) and public.current_user_can_view_season_team(team_id))
  or (exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_viewer and not profile.is_coach) and status <> 'draft')
  or public.player_can_access_match(id, (select auth.uid()))
);
create policy "Scoped staff can create matches" on public.matches for insert to authenticated with check (
  created_by = (select auth.uid()) and (select public.current_user_is_owner() or public.current_user_can_manage_season_team(team_id))
);
create policy "Scoped staff can update matches" on public.matches for update to authenticated
using ((select public.current_user_is_owner() or public.current_user_can_manage_season_team(team_id)))
with check ((select public.current_user_is_owner() or public.current_user_can_manage_season_team(team_id)));
create policy "Scoped staff can delete matches" on public.matches for delete to authenticated using (
  (select public.current_user_is_owner() or public.current_user_can_manage_season_team(team_id))
);

revoke all on function public.create_season_team(uuid,text,boolean) from public;
revoke all on function public.update_season_team(uuid,text,boolean,boolean) from public;
revoke all on function public.delete_season_team(uuid) from public;
revoke all on function public.assign_season_player_team(uuid,uuid,uuid) from public;
revoke all on function public.set_season_team_coach(uuid,uuid,boolean) from public;
grant execute on function public.create_season_team(uuid,text,boolean), public.update_season_team(uuid,text,boolean,boolean), public.delete_season_team(uuid), public.assign_season_player_team(uuid,uuid,uuid), public.set_season_team_coach(uuid,uuid,boolean), public.current_user_can_manage_season_team(uuid), public.current_user_can_view_season_team(uuid) to authenticated;
