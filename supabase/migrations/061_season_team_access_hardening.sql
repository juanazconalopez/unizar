-- Cada partido pertenece a su equipo de temporada. Los préstamos autorizados
-- conservan acceso a la ficha mediante su disponibilidad o convocatoria.

create or replace function public.current_user_can_view_season_team(checked_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_permission('matches.view') and (
    public.current_user_can_manage_season_team(checked_team_id) or exists (
      select 1
      from public.season_teams mixed
      join public.season_teams assigned on assigned.season_id = mixed.season_id
      join public.season_team_coaches assignment on assignment.season_team_id = assigned.id
      join public.profiles coach on coach.id = assignment.coach_id
      where mixed.id = checked_team_id and mixed.is_mixed
        and assignment.coach_id = (select auth.uid())
        and coach.is_coach and coach.is_approved and coach.is_active and not coach.is_archived
    )
  );
$$;

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

drop policy if exists "Scoped staff and players can read matches" on public.matches;
create policy "Scoped staff and players can read matches" on public.matches for select to authenticated using (
  (select public.current_user_has_permission('matches.view')) and (
    (select public.current_user_is_owner())
    or public.current_user_can_view_season_team(team_id)
    or (status <> 'draft' and exists (
      select 1 from public.profiles profile
      where profile.id = (select auth.uid()) and profile.is_viewer
    ))
    or public.player_can_access_match(id, (select auth.uid()))
  )
);

-- Las fechas de baja son datos personales. La plantilla y los entrenadores
-- solo necesitan la comprobación de elegibilidad, no el historial de bajas.
drop policy if exists "Players and scoped staff can read absences" on public.player_absences;
create policy "Players and owners can read absences" on public.player_absences for select to authenticated using (
  (player_id = (select auth.uid()) and (select public.current_user_is_approved()))
  or (select public.current_user_is_owner())
);

-- Los minutos mostrados al preparar una convocatoria respetan el equipo del
-- entrenador y el permiso de edición de alineaciones.
create or replace function public.get_season_player_minutes(checked_season_id uuid)
returns table(player_id uuid, played_minutes integer)
language sql stable security definer set search_path = '' as $$
  with official_lineups as (
    select match.id as match_id, match.duration_minutes, lineup.player_id, lineup.role
    from public.matches match join public.match_lineup lineup on lineup.match_id = match.id
    where match.season_id = checked_season_id
      and match.match_kind = 'official'::public.match_kind
      and match.status = 'completed'::public.match_status
      and public.current_user_has_permission('matches.lineup_edit')
      and public.current_user_can_view_season_team(match.team_id)
  ), intervals as (
    select lineup.*, case when lineup.role = 'starter'::public.lineup_role then 0 else coalesce((
      select min(event.event_minute) from public.match_events event
      where event.match_id = lineup.match_id and event.event_type = 'substitution'::public.match_event_type
        and event.replacement_player_id = lineup.player_id
    ), lineup.duration_minutes) end as starts_at,
    coalesce((select min(event.event_minute) from public.match_events event
      where event.match_id = lineup.match_id and event.player_id = lineup.player_id
        and event.event_type in ('substitution'::public.match_event_type, 'red_card'::public.match_event_type)
    ), lineup.duration_minutes) as ends_at
    from official_lineups lineup
  ), totals as (
    select interval.player_id, greatest(interval.ends_at - interval.starts_at - coalesce((
      select sum(greatest(0, least(interval.ends_at, event.event_minute + 10) - greatest(interval.starts_at, event.event_minute)))
      from public.match_events event where event.match_id = interval.match_id and event.player_id = interval.player_id
        and event.event_type = 'yellow_card'::public.match_event_type
    ), 0), 0)::integer as minutes
    from intervals interval
  ) select player_id, sum(minutes)::integer from totals group by player_id;
$$;

revoke all on function public.current_user_can_view_season_team(uuid),
  public.player_can_access_match(uuid,uuid), public.get_season_player_minutes(uuid) from public;
grant execute on function public.current_user_can_view_season_team(uuid),
  public.player_can_access_match(uuid,uuid), public.get_season_player_minutes(uuid) to authenticated;

-- Revalidar reservas externas al publicar: la fecha de otro borrador pudo
-- cambiar después de que los entrenadores guardaran sus propuestas.
create or replace function public.finalize_internal_match(checked_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare fixture_id uuid;
declare checked_date date;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('matches.lineup_publish') then
    raise exception 'Solo el owner puede publicar ambas convocatorias';
  end if;
  select internal_fixture_id, match_date into fixture_id, checked_date from public.matches where id = checked_match_id;
  if fixture_id is null then raise exception 'El partido no pertenece a un derbi'; end if;
  perform 1 from public.matches where match_date = checked_date order by id for update;
  perform 1 from public.matches where internal_fixture_id = fixture_id order by id for update;
  if (select count(*) from public.matches where internal_fixture_id = fixture_id and status = 'published') <> 2 then
    raise exception 'Publica primero las dos fichas del partido';
  end if;
  if exists (select 1 from public.match_lineup lineup join public.matches match on match.id = lineup.match_id
    where match.internal_fixture_id = fixture_id group by lineup.player_id having count(*) > 1) then
    raise exception 'Resuelve las jugadoras propuestas en ambas convocatorias';
  end if;
  if exists (
    select 1 from public.match_lineup lineup
    join public.matches match on match.id = lineup.match_id
    join public.match_lineup other_lineup on other_lineup.player_id = lineup.player_id
    join public.matches other_match on other_match.id = other_lineup.match_id
    where match.internal_fixture_id = fixture_id and other_match.match_date = checked_date
      and other_match.internal_fixture_id is distinct from fixture_id
  ) then raise exception 'Una jugadora ya está reservada en otro partido del mismo día'; end if;
  if exists (
    select 1 from public.match_lineup lineup join public.matches match on match.id = lineup.match_id
    left join public.match_availability availability on availability.match_id = match.id
      and availability.player_id = lineup.player_id and availability.status = 'available'::public.availability_status
    where match.internal_fixture_id = fixture_id
      and (availability.player_id is null or public.player_has_absence_on(lineup.player_id, match.match_date)
        or not exists (select 1 from public.season_players membership
          where membership.season_id = match.season_id and membership.player_id = lineup.player_id
            and membership.active_from <= match.match_date
            and (membership.active_until is null or membership.active_until >= match.match_date)))
  ) then raise exception 'Revisa disponibilidad, bajas y vinculación antes de publicar'; end if;
  perform set_config('app.internal_fixture_write', 'yes', true);
  update public.matches set lineup_published = true where internal_fixture_id = fixture_id;
end;
$$;

-- El nombre del rival de cada ficha del derbi refleja siempre el nombre actual
-- del otro equipo. Un equipo que ya disputa un derbi no puede pasar a mixto.
create or replace function public.update_season_team(checked_team_id uuid, checked_name text, checked_is_mixed boolean, checked_is_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare old_name text;
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede gestionar los equipos de la temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para el equipo';
  end if;
  select name into old_name from public.season_teams where id = checked_team_id for update;
  if not found then raise exception 'El equipo no existe'; end if;
  if checked_is_active = false and exists (
    select 1 from public.season_players where season_team_id = checked_team_id and active_until is null
  ) then raise exception 'Reasigna primero a las jugadoras activas de este equipo'; end if;
  if checked_is_mixed = true and exists (
    select 1 from public.matches where team_id = checked_team_id and internal_fixture_id is not null
  ) then raise exception 'Un equipo que participa en un derbi no puede convertirse en mixto'; end if;

  update public.season_teams
  set name = trim(checked_name), is_mixed = coalesce(checked_is_mixed, false), is_active = coalesce(checked_is_active, true)
  where id = checked_team_id;

  if old_name is distinct from trim(checked_name) then
    perform set_config('app.internal_fixture_write', 'yes', true);
    update public.matches other_match set opponent = trim(checked_name)
    where other_match.internal_fixture_id is not null and exists (
      select 1 from public.matches team_match
      where team_match.internal_fixture_id = other_match.internal_fixture_id
        and team_match.team_id = checked_team_id and team_match.id <> other_match.id
    );
  end if;
end;
$$;

-- Si ya existe una temporada futura, una jugadora aprobada después también
-- debe quedar vinculada. El periodo empieza al comenzar esa temporada.
create or replace function public.assign_active_season_on_player_authorization()
returns trigger language plpgsql security definer set search_path = '' as $$
declare today_in_madrid date := (pg_catalog.now() at time zone 'Europe/Madrid')::date;
begin
  if new.is_approved and new.is_active and new.is_player and not new.is_archived
    and (not old.is_approved or not old.is_active or not old.is_player or old.is_archived)
  then
    insert into public.season_players (season_id, player_id, active_from, active_until, season_team_id)
    select season.id, new.id, greatest(today_in_madrid, season.start_date), null, team.id
    from public.seasons season
    join public.season_teams team on team.season_id = season.id and team.is_default
    where season.end_date >= today_in_madrid
      and not exists (
        select 1 from public.season_players membership
        where membership.season_id = season.id and membership.player_id = new.id and membership.active_until is null
      )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

insert into public.season_players (season_id, player_id, active_from, active_until, season_team_id)
select season.id, player.id, season.start_date, null, team.id
from public.seasons season
join public.season_teams team on team.season_id = season.id and team.is_default
join public.profiles player on player.is_player and player.is_approved and player.is_active and not player.is_archived
where season.start_date > (pg_catalog.now() at time zone 'Europe/Madrid')::date
  and not exists (
    select 1 from public.season_players membership
    where membership.season_id = season.id and membership.player_id = player.id
  )
on conflict do nothing;
