-- Ficha deportiva por temporada, independiente de la vinculación y asistencia.
-- Ejecutar completa en el SQL Editor de Supabase. Las actuales empiezan Regional.
begin;

alter table public.season_players alter column season_team_id drop not null;
alter table public.season_competitions
  add column competition_level text not null default 'regional' check (competition_level in ('regional', 'national')),
  add column is_league boolean not null default false;

-- Momento de finalización: fija el corte del histórico cuando no hay hora de inicio.
-- Es un hecho del partido, no un total precalculado. Las correcciones lo conservan.
alter table public.matches add column completed_at timestamptz;
do $$
begin
  alter table public.matches disable trigger enforce_configurable_permission;
  perform set_config('app.internal_fixture_write','yes',true);
  update public.matches set completed_at = updated_at where status = 'completed';
  perform set_config('app.internal_fixture_write','no',true);
  alter table public.matches enable trigger enforce_configurable_permission;
end;
$$;
create function public.keep_match_completion_time()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.completed_at := case when new.status = 'completed' then clock_timestamp() else null end;
  else
    new.completed_at := coalesce(old.completed_at,case when new.status = 'completed' then clock_timestamp() else null end);
  end if;
  return new;
end;
$$;
create trigger matches_completion_time before insert or update on public.matches
for each row execute function public.keep_match_completion_time();
revoke all on function public.keep_match_completion_time() from public,anon,authenticated;

insert into public.permission_definitions
  (key, section_key, section_label, label, description, action, parent_key, sort_order, configurable, owner_only)
values ('seasons.licenses', 'seasons', 'Temporadas', 'Gestionar fichas de jugadoras',
  'Asignar y corregir la ficha deportiva de cada temporada.', 'edit', 'settings.team', 1260, false, true);

create table public.season_player_licenses (
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  license_type text not null default 'none' check (license_type in ('none','training','regional','national')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  primary key (season_id, player_id)
);
create table public.player_license_history (
  id bigint generated always as identity primary key,
  season_id uuid not null,
  player_id uuid not null,
  previous_license text check (previous_license in ('none','training','regional','national')),
  license_type text not null check (license_type in ('none','training','regional','national')),
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id),
  foreign key (season_id,player_id) references public.season_player_licenses(season_id,player_id) on delete cascade
);
create index player_license_history_effective_idx on public.player_license_history (season_id,player_id,changed_at desc,id desc);

insert into public.season_player_licenses (season_id,player_id,license_type)
select distinct season_id,player_id,'regional' from public.season_players;
insert into public.player_license_history (season_id,player_id,license_type,changed_at)
select season_id,player_id,'regional',min(active_from)::timestamp at time zone 'Europe/Madrid'
from public.season_players group by season_id,player_id;

alter table public.season_player_licenses enable row level security;
alter table public.player_license_history enable row level security;
create policy "Read own or team licenses" on public.season_player_licenses for select to authenticated using (
  (select public.current_user_is_approved()) and ((player_id = (select auth.uid()) and (select public.current_user_is_active_player()))
    or (select public.current_user_has_permission('seasons.licenses')) or (select public.current_user_can_view_team_data()))
);
create policy "Owners read license history" on public.player_license_history for select to authenticated
using ((select public.current_user_has_permission('seasons.licenses')));
grant select on public.season_player_licenses, public.player_license_history to authenticated;
revoke insert,update,delete on public.season_player_licenses, public.player_license_history from authenticated;

-- Estas funciones internas no están expuestas por la API.
create function public.national_league_starts(checked_season_id uuid, checked_player_id uuid, before_match_id uuid default null)
returns integer language sql stable security definer set search_path = '' as $$
  select count(distinct match.id)::integer
  from public.matches match
  join public.season_competitions competition on competition.id = match.competition_id
  join public.match_lineup lineup on lineup.match_id = match.id and lineup.player_id = checked_player_id
  where match.season_id = checked_season_id and match.match_kind = 'official'
    and match.status = 'completed' and match.report_events_reviewed and lineup.role = 'starter'
    and competition.competition_level = 'national' and competition.is_league
    and exists (select 1 from public.season_players membership
      where membership.season_id = match.season_id and membership.player_id = checked_player_id
        and membership.active_from <= match.match_date
        and (membership.active_until is null or membership.active_until >= match.match_date))
    and (before_match_id is null or exists (
      select 1 from public.matches target where target.id = before_match_id and match.id <> target.id
        and (match.match_date < target.match_date or (match.match_date = target.match_date
          and (match.kickoff_time is null or target.kickoff_time is null or match.kickoff_time <= target.kickoff_time)))
    ));
$$;

create function public.player_license_allows_match(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches match
    join public.season_player_licenses license on license.season_id = match.season_id and license.player_id = checked_player_id
    left join public.season_competitions competition on competition.id = match.competition_id
    cross join lateral (
      select case when match.status <> 'completed' and match.match_date >= (pg_catalog.now() at time zone 'Europe/Madrid')::date
        then license.license_type
        else coalesce((select history.license_type from public.player_license_history history
          where history.season_id = match.season_id and history.player_id = checked_player_id
            and history.changed_at <= least((match.match_date + coalesce(match.kickoff_time, time '23:59:59')) at time zone 'Europe/Madrid',
              coalesce(match.completed_at,'infinity'::timestamptz))
          order by history.changed_at desc,history.id desc limit 1),'none') end as license_type
    ) effective
    where match.id = checked_match_id and exists (
      select 1 from public.season_players membership where membership.season_id = match.season_id
        and membership.player_id = checked_player_id and membership.active_from <= match.match_date
        and (membership.active_until is null or membership.active_until >= match.match_date)
    ) and (match.match_kind = 'friendly' or (
      effective.license_type in ('regional','national')
      and (competition.competition_level = 'regional' or effective.license_type = 'national')
      and (competition.competition_level <> 'regional'
        or public.national_league_starts(match.season_id,checked_player_id,match.id) < 6)
    ))
  );
$$;

create function public.get_player_season_memberships(checked_player_id uuid default null)
returns table (id uuid,season_id uuid,player_id uuid,active_from date,active_until date,
  created_at timestamptz,season_team_id uuid,license_type text,national_starts integer)
language sql stable security definer set search_path = '' as $$
  select membership.id,membership.season_id,membership.player_id,membership.active_from,membership.active_until,
    membership.created_at,membership.season_team_id,coalesce(license.license_type,'none'),
    public.national_league_starts(membership.season_id,membership.player_id)
  from public.season_players membership
  left join public.season_player_licenses license on license.season_id = membership.season_id and license.player_id = membership.player_id
  where public.current_user_is_approved()
    and (checked_player_id is null or membership.player_id = checked_player_id)
    and ((membership.player_id = (select auth.uid()) and public.current_user_is_active_player())
      or (public.current_user_is_owner() and public.current_user_has_permission('seasons.licenses')) or public.current_user_can_view_team_data());
$$;

-- Toda incorporación conserva la vinculación, pero empieza sin ficha ni equipo.
create function public.initialize_player_license()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.season_player_licenses (season_id,player_id) values (new.season_id,new.player_id)
  on conflict do nothing;
  if not exists (select 1 from public.player_license_history history where history.season_id = new.season_id and history.player_id = new.player_id) then
    insert into public.player_license_history (season_id,player_id,license_type,changed_at)
    values (new.season_id,new.player_id,'none',new.active_from::timestamp at time zone 'Europe/Madrid');
  end if;
  if new.season_team_id is not null and not exists (select 1 from public.season_player_licenses license
    where license.season_id = new.season_id and license.player_id = new.player_id and license.license_type in ('regional','national')) then
    raise exception 'Sin ficha deportiva no se puede asignar un equipo';
  end if;
  return new;
end;
$$;
create trigger season_players_license_guard before insert or update of season_team_id,season_id,player_id on public.season_players
for each row execute function public.initialize_player_license();

create function public.set_season_player_license(checked_season_id uuid,checked_player_id uuid,checked_license text,checked_team_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare old_license text; affected integer;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('seasons.licenses') then
    raise exception 'Solo el owner puede gestionar fichas';
  end if;
  if checked_license is null or checked_license not in ('none','training','regional','national') then raise exception 'Tipo de ficha no válido'; end if;
  perform 1 from public.season_players membership where membership.season_id = checked_season_id
    and membership.player_id = checked_player_id order by membership.id for update;
  if not found then raise exception 'La jugadora no pertenece a esta temporada'; end if;
  if not exists (select 1 from public.profiles where id = checked_player_id and is_player) then raise exception 'El perfil no es una jugadora'; end if;
  if checked_license in ('none','training') and checked_team_id is not null then raise exception 'Esta ficha no permite pertenecer a un equipo'; end if;
  if checked_team_id is not null and not exists (select 1 from public.season_teams
    where id = checked_team_id and season_id = checked_season_id and is_active) then raise exception 'El equipo no está activo en esta temporada'; end if;
  select license_type into old_license from public.season_player_licenses
  where season_id = checked_season_id and player_id = checked_player_id for update;
  if old_license is distinct from checked_license then
    update public.season_player_licenses set license_type = checked_license,updated_at = clock_timestamp(),updated_by = (select auth.uid())
    where season_id = checked_season_id and player_id = checked_player_id;
    insert into public.player_license_history (season_id,player_id,previous_license,license_type,changed_by,changed_at)
    values (checked_season_id,checked_player_id,old_license,checked_license,(select auth.uid()),clock_timestamp());
  end if;
  -- No reescribir asignaciones de periodos cerrados ni borrar disponibilidades/convocatorias.
  update public.season_players set season_team_id = checked_team_id
  where season_id = checked_season_id and player_id = checked_player_id and active_until is null;
  select count(distinct match.id)::integer into affected from public.matches match
  join public.match_lineup lineup on lineup.match_id = match.id and lineup.player_id = checked_player_id
  where match.season_id = checked_season_id and match.status = 'published'
    and match.match_date >= (pg_catalog.now() at time zone 'Europe/Madrid')::date
    and not public.player_license_allows_match(match.id,checked_player_id);
  return affected;
end;
$$;

create or replace function public.create_default_season_team()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.season_teams (season_id,name,is_default,created_by) values (new.id,'Unizar Femenino',true,new.created_by);
  insert into public.season_players (season_id,player_id,active_from,active_until)
  select new.id,profile.id,new.start_date,null from public.profiles profile
  where profile.is_player and profile.is_approved and profile.is_active and not profile.is_archived on conflict do nothing;
  return new;
end;
$$;
create or replace function public.assign_active_season_on_player_authorization()
returns trigger language plpgsql security definer set search_path = '' as $$
declare today_in_madrid date := (pg_catalog.now() at time zone 'Europe/Madrid')::date;
begin
  if new.is_approved and new.is_active and new.is_player and not new.is_archived
    and (not old.is_approved or not old.is_active or not old.is_player or old.is_archived) then
    insert into public.season_players (season_id,player_id,active_from,active_until)
    select season.id,new.id,greatest(today_in_madrid,season.start_date),null from public.seasons season
    where season.end_date >= today_in_madrid and not exists (select 1 from public.season_players membership
      where membership.season_id = season.id and membership.player_id = new.id and membership.active_until is null)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Valida también escrituras directas de disponibilidad y las publicaciones conjuntas.
-- La vinculación se bloquea para coordinar respuestas/convocatorias con cambios de ficha.
create function public.guard_match_player_license()
returns trigger language plpgsql security definer set search_path = '' as $$
declare checked_match public.matches%rowtype;
begin
  select * into checked_match from public.matches where id = new.match_id;
  if tg_table_name = 'match_availability' and checked_match.status <> 'published' then
    raise exception 'El partido no está abierto para registrar disponibilidad';
  end if;
  perform 1 from public.season_players membership where membership.season_id = checked_match.season_id
    and membership.player_id = new.player_id order by membership.id for share;
  -- Los resultados pasados pueden corregirse sin alterar la verdad del partido.
  if (tg_table_name = 'match_availability' or checked_match.status <> 'completed') and not public.player_license_allows_match(new.match_id,new.player_id) then
    raise exception 'La ficha de la jugadora no permite participar en este partido';
  end if;
  return new;
end;
$$;
create trigger match_availability_license_guard before insert or update on public.match_availability
for each row execute function public.guard_match_player_license();
create trigger match_lineup_license_guard before insert or update on public.match_lineup
for each row execute function public.guard_match_player_license();

create function public.guard_published_lineup_licenses()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lineup_published and new.status <> 'completed'
    and (not old.lineup_published or (new.competition_id,new.match_date,new.kickoff_time) is distinct from (old.competition_id,old.match_date,old.kickoff_time)) then
    perform 1 from public.season_players membership join public.match_lineup lineup on lineup.player_id = membership.player_id
    where lineup.match_id = new.id and membership.season_id = new.season_id order by membership.id for share;
    if exists (select 1 from public.match_lineup lineup where lineup.match_id = new.id
      and not public.player_license_allows_match(new.id,lineup.player_id)) then
      raise exception 'Revisa las fichas y las titularidades nacionales antes de publicar la convocatoria';
    end if;
  end if;
  return new;
end;
$$;
-- AFTER ve los nuevos valores de competición/fecha; una excepción revierte la escritura.
create trigger matches_published_license_guard after update on public.matches
for each row execute function public.guard_published_lineup_licenses();

revoke all on function public.national_league_starts(uuid,uuid,uuid),public.player_license_allows_match(uuid,uuid),
  public.initialize_player_license(),public.guard_match_player_license(),public.guard_published_lineup_licenses() from public,anon,authenticated;
revoke all on function public.get_player_season_memberships(uuid), public.set_season_player_license(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.get_player_season_memberships(uuid),public.set_season_player_license(uuid,uuid,text,uuid) to authenticated;

create or replace function public.player_can_access_match(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches match
    join public.season_players membership on membership.season_id = match.season_id and membership.player_id = checked_player_id
    join public.profiles player on player.id = checked_player_id
    where match.id = checked_match_id and match.status <> 'draft'
      and player.is_approved and player.is_active and not player.is_archived and player.is_player
      and membership.active_from <= match.match_date
      and (membership.active_until is null or membership.active_until >= match.match_date)
      and not public.player_has_absence_on(checked_player_id, match.match_date)
      and (
        (match.team_id is null and match.internal_fixture_id is null)
        or membership.season_team_id is null
        or (match.lineup_published and exists (
          select 1 from public.match_lineup lineup
          where lineup.match_id = match.id and lineup.player_id = checked_player_id
        ))
        or (
          (membership.season_team_id = match.team_id
            or exists (select 1 from public.season_teams mixed
              where mixed.id = membership.season_team_id and mixed.is_mixed)
            or exists (select 1 from public.match_availability availability
              where availability.match_id = match.id and availability.player_id = checked_player_id))
          and (match.internal_fixture_id is null or not exists (
            select 1 from public.matches paired
            join public.match_lineup other_lineup on other_lineup.match_id = paired.id
            where paired.internal_fixture_id = match.internal_fixture_id and paired.id <> match.id
              and paired.lineup_published and other_lineup.player_id = checked_player_id
          ))
        )
      )
  );
$$;

create or replace function public.save_match_lineup(checked_match_id uuid, lineup_entries jsonb, publish_lineup boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare maximum_slots integer;
declare starter_slots integer;
declare was_published boolean;
declare checked_date date;
declare fixture_id uuid;
begin
  if not public.current_user_can_edit_match(checked_match_id) or not public.current_user_has_permission('matches.lineup_edit') then
    raise exception 'No tienes permiso para gestionar esta convocatoria';
  end if;
  select case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end, lineup_published, match_date, internal_fixture_id
  into maximum_slots, starter_slots, was_published, checked_date, fixture_id
  from public.matches where id = checked_match_id for update;
  if not found then raise exception 'El partido no existe'; end if;
  if was_published then raise exception 'La convocatoria publicada ya no se puede modificar'; end if;
  if fixture_id is not null and publish_lineup then raise exception 'El owner debe publicar juntas las dos convocatorias'; end if;
  if fixture_id is null and publish_lineup and not public.current_user_has_permission('matches.lineup_publish') then
    raise exception 'No tienes permiso para publicar convocatorias';
  end if;
  if jsonb_typeof(lineup_entries) is distinct from 'array' then raise exception 'La convocatoria debe ser una lista'; end if;
  perform 1 from public.matches where match_date = checked_date order by id for update;
  if exists (select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    where coalesce((entry->>'slot_number')::smallint, 0) not between 1 and maximum_slots) then
    raise exception 'El dorsal no es válido para este tipo de partido';
  end if;
  if exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    join public.matches match on match.id = checked_match_id
    left join public.season_players membership on membership.season_id = match.season_id
      and membership.player_id = (entry->>'player_id')::uuid
      and membership.active_from <= match.match_date
      and (membership.active_until is null or membership.active_until >= match.match_date)
    left join public.profiles player on player.id = (entry->>'player_id')::uuid
    left join public.match_availability availability on availability.match_id = checked_match_id
      and availability.player_id = (entry->>'player_id')::uuid and availability.status = 'available'::public.availability_status
    where membership.id is null or player.id is null or availability.player_id is null
      or not player.is_approved or not player.is_active or player.is_archived or not player.is_player
      or public.player_has_absence_on((entry->>'player_id')::uuid, match.match_date)
  ) then raise exception 'La convocatoria contiene una jugadora que no está disponible'; end if;
  if not public.current_user_is_owner() and exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    join public.matches match on match.id = checked_match_id
    join public.season_players membership on membership.season_id = match.season_id
      and membership.player_id = (entry->>'player_id')::uuid
      and membership.active_from <= match.match_date
      and (membership.active_until is null or membership.active_until >= match.match_date)
    left join public.season_teams team on team.id = membership.season_team_id
    where not (match.match_kind = 'friendly' and membership.season_team_id is null)
      and membership.season_team_id is distinct from match.team_id and coalesce(team.is_mixed, false) = false
  ) then raise exception 'Solo el owner puede incorporar jugadoras de otro equipo'; end if;
  if exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    join public.match_lineup other_lineup on other_lineup.player_id = (entry->>'player_id')::uuid
    join public.matches other_match on other_match.id = other_lineup.match_id
    where other_match.match_date = checked_date and other_match.id <> checked_match_id
      and (fixture_id is null or other_match.internal_fixture_id is distinct from fixture_id)
  ) then raise exception 'Una jugadora ya está reservada en la convocatoria de otro partido del mismo día'; end if;
  delete from public.match_lineup where match_id = checked_match_id;
  insert into public.match_lineup (match_id, player_id, role, position, slot_number, sort_order)
  select checked_match_id, (entry->>'player_id')::uuid,
    case when (entry->>'slot_number')::smallint <= starter_slots then 'starter'::public.lineup_role else 'substitute'::public.lineup_role end,
    null, (entry->>'slot_number')::smallint, (entry->>'slot_number')::smallint
  from jsonb_array_elements(lineup_entries) entries(entry);
  if fixture_id is null then
    update public.matches set lineup_published = publish_lineup where id = checked_match_id;
  end if;
end;
$$;

create or replace function public.set_player_match_availability(
  checked_match_id uuid, checked_player_id uuid,
  checked_status public.availability_status, checked_comment text
)
returns void language plpgsql security definer set search_path = '' as $$
declare normalized_comment text := nullif(trim(coalesce(checked_comment, '')), '');
declare checked_match public.matches%rowtype;
begin
  if not public.current_user_can_edit_match(checked_match_id) or not public.current_user_has_permission('matches.availability_edit') then
    raise exception 'No tienes permiso para modificar la disponibilidad de este partido';
  end if;
  if length(coalesce(normalized_comment, '')) > 500 then raise exception 'El comentario no puede superar los 500 caracteres'; end if;
  select * into checked_match from public.matches where id = checked_match_id and status = 'published'::public.match_status for update;
  if not found then raise exception 'El partido no está disponible para registrar respuestas'; end if;
  if checked_match.lineup_published then raise exception 'Desbloquea la convocatoria antes de modificar disponibilidades'; end if;
  if public.player_has_absence_on(checked_player_id, checked_match.match_date) then raise exception 'La jugadora está de baja en esta fecha'; end if;
  if not exists (
    select 1 from public.season_players membership
    join public.profiles player on player.id = membership.player_id
    left join public.season_teams team on team.id = membership.season_team_id
    where membership.season_id = checked_match.season_id and membership.player_id = checked_player_id
      and membership.active_from <= checked_match.match_date
      and (membership.active_until is null or membership.active_until >= checked_match.match_date)
      and player.is_player and player.is_approved and player.is_active and not player.is_archived
      and (public.current_user_is_owner() or (checked_match.match_kind = 'friendly' and membership.season_team_id is null) or membership.season_team_id = checked_match.team_id or coalesce(team.is_mixed, false))
  ) then raise exception 'La jugadora no pertenece a un equipo permitido para esta convocatoria'; end if;
  insert into public.match_availability (match_id, player_id, status, comment)
  values (checked_match_id, checked_player_id, checked_status, normalized_comment)
  on conflict (match_id, player_id) do update set status = excluded.status, comment = excluded.comment;
  insert into public.match_availability_coach_changes (match_id, player_id, changed_by, status, comment)
  values (checked_match_id, checked_player_id, (select auth.uid()), checked_status, normalized_comment);
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

create or replace function public.get_season_callup_report(checked_season_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
begin
  if not public.current_user_can_manage_tasks() then
    raise exception 'No tienes permiso para consultar el resumen de convocatorias';
  end if;

  if not exists (select 1 from public.seasons where id = checked_season_id) then
    raise exception 'La temporada no existe';
  end if;

  with participant_ids as (
    select distinct sp.player_id
    from public.season_players sp
    where sp.season_id = checked_season_id
  ),
  counted_matches as (
    select m.id, m.match_kind, m.match_date
    from public.matches m
    where m.season_id = checked_season_id
      and m.lineup_published
      and m.status <> 'cancelled'::public.match_status
  ),
  candidate_players as (
    select ml.match_id, ml.player_id
    from public.match_lineup ml
    join counted_matches cm on cm.id = ml.match_id
    union
    select ma.match_id, ma.player_id
    from public.match_availability ma
    join counted_matches cm on cm.id = ma.match_id
    where cm.match_kind = 'friendly'::public.match_kind
      and ma.status = 'available'::public.availability_status
  ),
  effective_callups as (
    select
      cm.id as match_id,
      cm.match_kind,
      cm.match_date,
      candidates.player_id,
      public.effective_callup_role(cm.match_kind, true, ma.status, ml.role) as role
    from counted_matches cm
    join candidate_players candidates on candidates.match_id = cm.id
    left join public.match_availability ma
      on ma.match_id = cm.id and ma.player_id = candidates.player_id
    left join public.match_lineup ml
      on ml.match_id = cm.id and ml.player_id = candidates.player_id
  ),
  callups as (
    select
      ec.player_id,
      count(distinct ec.match_id) filter (where ec.match_kind = 'official'::public.match_kind)::integer as official_callups,
      count(distinct ec.match_id) filter (where ec.match_kind = 'friendly'::public.match_kind)::integer as friendly_callups,
      count(distinct ec.match_id) filter (where ec.role = 'starter'::public.lineup_role)::integer as starter_callups,
      count(distinct ec.match_id) filter (where ec.role = 'substitute'::public.lineup_role)::integer as substitute_callups
    from effective_callups ec
    where ec.role is not null
      and exists (
        select 1 from public.season_players sp
        where sp.season_id = checked_season_id
          and sp.player_id = ec.player_id
          and ec.match_date >= sp.active_from
          and (sp.active_until is null or ec.match_date <= sp.active_until)
      )
    group by ec.player_id
  ),
  player_rows as (
    select
      p.id as player_id,
      p.display_name,
      coalesce(c.official_callups, 0) as official_callups,
      coalesce(c.friendly_callups, 0) as friendly_callups,
      coalesce(c.starter_callups, 0) as starter_callups,
      coalesce(c.substitute_callups, 0) as substitute_callups,
      (
        select count(*)::integer
        from public.matches m
        where m.season_id = checked_season_id
          and m.status in ('published'::public.match_status, 'completed'::public.match_status)
          and public.player_license_allows_match(m.id,p.id)
          and exists (
            select 1 from public.season_players sp
            where sp.season_id = checked_season_id
              and sp.player_id = p.id
              and m.match_date >= sp.active_from
              and (sp.active_until is null or m.match_date <= sp.active_until)
          )
      ) as eligible_matches,
      (
        select count(*)::integer
        from public.matches m
        join public.match_availability ma on ma.match_id = m.id and ma.player_id = p.id
        where m.season_id = checked_season_id
          and m.status in ('published'::public.match_status, 'completed'::public.match_status)
          and public.player_license_allows_match(m.id,p.id)
          and exists (
            select 1 from public.season_players sp
            where sp.season_id = checked_season_id
              and sp.player_id = p.id
              and m.match_date >= sp.active_from
              and (sp.active_until is null or m.match_date <= sp.active_until)
          )
      ) as availability_responded,
      (
        select count(*)::integer
        from public.training_sessions ts
        where ts.season_id = checked_season_id
          and ts.session_date <= current_date
          and exists (
            select 1 from public.season_players sp
            where sp.season_id = checked_season_id
              and sp.player_id = p.id
              and ts.session_date >= sp.active_from
              and (sp.active_until is null or ts.session_date <= sp.active_until)
          )
      ) as eligible_sessions,
      (
        select count(*)::integer
        from public.training_sessions ts
        join public.training_attendance ta
          on ta.session_id = ts.id
         and ta.player_id = p.id
         and ta.attended
        where ts.season_id = checked_season_id
          and ts.session_date <= current_date
          and exists (
            select 1 from public.season_players sp
            where sp.season_id = checked_season_id
              and sp.player_id = p.id
              and ts.session_date >= sp.active_from
              and (sp.active_until is null or ts.session_date <= sp.active_until)
          )
      ) as attended_sessions
    from participant_ids participants
    join public.profiles p on p.id = participants.player_id
    left join callups c on c.player_id = p.id
  ),
  totals as (
    select
      count(*) filter (where match_kind = 'official'::public.match_kind)::integer as official_matches,
      count(*) filter (where match_kind = 'friendly'::public.match_kind)::integer as friendly_matches
    from counted_matches
  )
  select jsonb_build_object(
    'seasonId', s.id,
    'seasonName', s.name,
    'generatedOn', current_date,
    'totals', jsonb_build_object(
      'officialMatches', t.official_matches,
      'friendlyMatches', t.friendly_matches,
      'trainingSessions', (
        select count(*)::integer
        from public.training_sessions ts
        where ts.season_id = checked_season_id
          and ts.session_date <= current_date
      )
    ),
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'playerId', pr.player_id,
          'name', pr.display_name,
          'officialCallups', pr.official_callups,
          'friendlyCallups', pr.friendly_callups,
          'starterCallups', pr.starter_callups,
          'substituteCallups', pr.substitute_callups,
          'eligibleMatches', pr.eligible_matches,
          'availabilityResponded', pr.availability_responded,
          'availabilityPercentage', case
            when pr.eligible_matches = 0 then null
            else round(pr.availability_responded * 100.0 / pr.eligible_matches)::integer
          end,
          'attendedSessions', pr.attended_sessions,
          'eligibleSessions', pr.eligible_sessions,
          'attendancePercentage', case
            when pr.eligible_sessions = 0 then null
            else round(pr.attended_sessions * 100.0 / pr.eligible_sessions)::integer
          end
        ) order by
          pr.official_callups desc,
          pr.friendly_callups desc,
          case when pr.eligible_sessions = 0 then -1
            else pr.attended_sessions * 100.0 / pr.eligible_sessions end desc,
          pr.display_name
      )
      from player_rows pr
    ), '[]'::jsonb)
  ) into report
  from public.seasons s
  cross join totals t
  where s.id = checked_season_id;

  return report;
end;
$$;

drop function public.create_season_competition(uuid,text,text);

create or replace function public.create_season_competition(
  checked_season_id uuid,
  checked_name text,
  checked_color text,
  checked_level text default 'regional', checked_is_league boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  created_id uuid;
  make_default boolean;
begin
  if checked_level is null or checked_level not in ('regional','national') then raise exception 'Nivel de competición no válido'; end if;
  if not public.current_user_has_permission('seasons.competitions') then
    raise exception 'Solo el owner puede gestionar las competiciones de una temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para la competición';
  end if;
  if checked_color not in ('purple', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold') then
    raise exception 'El color seleccionado no es válido';
  end if;

  perform 1 from public.seasons where id = checked_season_id for update;
  if not found then raise exception 'La temporada no existe'; end if;

  select not exists (
    select 1 from public.season_competitions where season_id = checked_season_id
  ) into make_default;

  insert into public.season_competitions (season_id, name, color, is_default, created_by)
  values (checked_season_id, trim(checked_name), checked_color, make_default, (select auth.uid()))
  returning id into created_id;
  update public.season_competitions set competition_level = checked_level,is_league = coalesce(checked_is_league,false) where id = created_id;
  return created_id;
end;
$$;

drop function public.update_season_competition(uuid,text,text);

create or replace function public.update_season_competition(
  checked_competition_id uuid,
  checked_name text,
  checked_color text,
  checked_level text default 'regional', checked_is_league boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('seasons.competitions') then
    raise exception 'Solo el owner puede gestionar las competiciones de una temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para la competición';
  end if;
  if checked_color not in ('purple', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold') then
    raise exception 'El color seleccionado no es válido';
  end if;

  update public.season_competitions
  set name = trim(checked_name), color = checked_color, competition_level = checked_level,is_league = coalesce(checked_is_league,false)
  where id = checked_competition_id;
  if not found then raise exception 'La competición no existe'; end if;
end;
$$;

create or replace function public.get_player_season_summary(
  checked_season_id uuid,
  checked_player_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  summary jsonb;
begin
  if checked_player_id <> (select auth.uid()) and not public.current_user_can_manage_tasks() then
    raise exception 'No tienes permiso para consultar este resumen de temporada';
  end if;

  if not exists (
    select 1 from public.season_players sp
    where sp.season_id = checked_season_id and sp.player_id = checked_player_id
  ) then
    raise exception 'La jugadora no pertenece a esta temporada';
  end if;

  with eligible_matches as (
    select m.*
    from public.matches m
    where m.season_id = checked_season_id
      and m.status in ('published'::public.match_status, 'completed'::public.match_status)
      and public.player_license_allows_match(m.id,checked_player_id)
      and exists (
        select 1 from public.season_players sp
        where sp.season_id = checked_season_id
          and sp.player_id = checked_player_id
          and m.match_date >= sp.active_from
          and (sp.active_until is null or m.match_date <= sp.active_until)
      )
  ),
  match_detail as (
    select
      m.id,
      m.match_date,
      m.opponent,
      m.match_kind,
      m.rugby_format,
      m.is_home,
      ma.status as availability_status,
      public.effective_callup_role(m.match_kind, m.lineup_published, ma.status, ml.role) as lineup_role,
      case when m.lineup_published then ml.slot_number else null end as slot_number
    from eligible_matches m
    left join public.match_availability ma
      on ma.match_id = m.id and ma.player_id = checked_player_id
    left join public.match_lineup ml
      on ml.match_id = m.id and ml.player_id = checked_player_id
  ),
  attendance as (
    select
      count(*)::integer as eligible_sessions,
      count(*) filter (where ta.attended)::integer as attended_sessions
    from public.training_sessions ts
    left join public.training_attendance ta
      on ta.session_id = ts.id and ta.player_id = checked_player_id
    where ts.season_id = checked_season_id
      and ts.session_date <= current_date
      and exists (
        select 1 from public.season_players sp
        where sp.season_id = checked_season_id
          and sp.player_id = checked_player_id
          and ts.session_date >= sp.active_from
          and (sp.active_until is null or ts.session_date <= sp.active_until)
      )
  ),
  match_totals as (
    select
      count(*)::integer as eligible_matches,
      count(*) filter (where availability_status is not null)::integer as availability_responded,
      count(*) filter (where availability_status = 'available'::public.availability_status)::integer as available,
      count(*) filter (where availability_status = 'doubt'::public.availability_status)::integer as doubt,
      count(*) filter (where availability_status = 'unavailable'::public.availability_status)::integer as unavailable,
      count(*) filter (where lineup_role is not null and match_kind = 'official'::public.match_kind)::integer as official_callups,
      count(*) filter (where lineup_role is not null and match_kind = 'friendly'::public.match_kind)::integer as friendly_callups,
      count(*) filter (where lineup_role = 'starter'::public.lineup_role)::integer as starter_callups,
      count(*) filter (where lineup_role = 'substitute'::public.lineup_role)::integer as substitute_callups
    from match_detail
  )
  select jsonb_build_object(
    'seasonId', s.id,
    'seasonName', s.name,
    'playerId', p.id,
    'playerName', p.display_name,
    'generatedOn', current_date,
    'callups', jsonb_build_object(
      'official', mt.official_callups,
      'friendly', mt.friendly_callups,
      'starter', mt.starter_callups,
      'substitute', mt.substitute_callups
    ),
    'availability', jsonb_build_object(
      'eligibleMatches', mt.eligible_matches,
      'responded', mt.availability_responded,
      'available', mt.available,
      'doubt', mt.doubt,
      'unavailable', mt.unavailable,
      'unanswered', mt.eligible_matches - mt.availability_responded,
      'percentage', case when mt.eligible_matches = 0 then null
        else round(mt.availability_responded * 100.0 / mt.eligible_matches)::integer end
    ),
    'attendance', jsonb_build_object(
      'attended', a.attended_sessions,
      'eligibleSessions', a.eligible_sessions,
      'percentage', case when a.eligible_sessions = 0 then null
        else round(a.attended_sessions * 100.0 / a.eligible_sessions)::integer end
    ),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'matchId', md.id,
        'date', md.match_date,
        'opponent', md.opponent,
        'kind', md.match_kind,
        'format', md.rugby_format,
        'isHome', md.is_home,
        'availabilityStatus', md.availability_status,
        'calledUp', md.lineup_role is not null,
        'lineupRole', md.lineup_role,
        'slotNumber', md.slot_number
      ) order by md.match_date desc, md.id)
      from match_detail md
    ), '[]'::jsonb)
  ) into summary
  from public.seasons s
  join public.profiles p on p.id = checked_player_id
  cross join attendance a
  cross join match_totals mt
  where s.id = checked_season_id;

  return summary;
end;
$$;

revoke all on function public.create_season_competition(uuid,text,text,text,boolean), public.update_season_competition(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.create_season_competition(uuid,text,text,text,boolean), public.update_season_competition(uuid,text,text,text,boolean) to authenticated;
commit;
