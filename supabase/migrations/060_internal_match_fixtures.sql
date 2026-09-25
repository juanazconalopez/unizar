-- Un partido entre dos equipos del club tiene una ficha y una convocatoria por
-- equipo. Ambas fichas comparten un identificador y se crean juntas.
alter table public.matches add column internal_fixture_id uuid;
create index matches_internal_fixture_idx on public.matches (internal_fixture_id) where internal_fixture_id is not null;
create unique index matches_internal_fixture_team_idx on public.matches (internal_fixture_id, team_id) where internal_fixture_id is not null;

create or replace function public.guard_internal_match_structure()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.internal_fixture_id is not null and current_setting('app.internal_fixture_write', true) is distinct from 'yes' then
      raise exception 'Gestiona los partidos entre equipos desde su acción conjunta';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if (old.internal_fixture_id is not null or new.internal_fixture_id is not null)
      and current_setting('app.internal_fixture_write', true) is distinct from 'yes' then
      raise exception 'Gestiona los partidos entre equipos desde su acción conjunta';
    end if;
    return new;
  end if;
  if old.internal_fixture_id is not null and current_setting('app.internal_fixture_write', true) is distinct from 'yes' then
    raise exception 'Gestiona los partidos entre equipos desde su acción conjunta';
  end if;
  return old;
end;
$$;
create trigger matches_guard_internal_fixture before insert or update or delete on public.matches
for each row execute function public.guard_internal_match_structure();

create or replace function public.create_internal_match(checked_values jsonb, checked_home_team_id uuid, checked_away_team_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fixture_id uuid := gen_random_uuid();
declare home_name text;
declare away_name text;
declare checked_season_id uuid := (checked_values->>'season_id')::uuid;
declare checked_date date := (checked_values->>'match_date')::date;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('matches.create') then
    raise exception 'Solo el owner puede crear partidos entre equipos del club';
  end if;
  if checked_home_team_id = checked_away_team_id then raise exception 'Selecciona dos equipos distintos'; end if;
  select name into home_name from public.season_teams where id = checked_home_team_id and season_id = checked_season_id and is_active and not is_mixed;
  select name into away_name from public.season_teams where id = checked_away_team_id and season_id = checked_season_id and is_active and not is_mixed;
  if home_name is null or away_name is null then raise exception 'Los dos equipos deben estar activos en la temporada'; end if;
  if not exists (select 1 from public.seasons where id = checked_season_id and checked_date between start_date and end_date) then
    raise exception 'La fecha no pertenece a la temporada';
  end if;
  if (checked_values->>'match_kind') is distinct from 'official' then raise exception 'El derbi debe ser un partido oficial'; end if;
  if not exists (select 1 from public.season_competitions where id = (checked_values->>'competition_id')::uuid and season_id = checked_season_id) then
    raise exception 'Selecciona una competición de la temporada';
  end if;
  perform set_config('app.internal_fixture_write', 'yes', true);
  insert into public.matches (season_id, competition_id, opponent, match_date, kickoff_time, venue, callup_time, callup_venue,
    is_home, notes, status, match_kind, rugby_format, team_id, internal_fixture_id, created_by)
  select checked_season_id, (checked_values->>'competition_id')::uuid,
    case when side.home then away_name else home_name end, checked_date,
    nullif(checked_values->>'kickoff_time', '')::time, nullif(checked_values->>'venue', ''),
    nullif(checked_values->>'callup_time', '')::time, nullif(checked_values->>'callup_venue', ''),
    side.home, nullif(checked_values->>'notes', ''), (checked_values->>'status')::public.match_status,
    'official'::public.match_kind, (checked_values->>'rugby_format')::public.rugby_format,
    case when side.home then checked_home_team_id else checked_away_team_id end, fixture_id, (select auth.uid())
  from (values (true), (false)) side(home);
  return fixture_id;
end;
$$;

create or replace function public.update_internal_match(checked_match_id uuid, checked_values jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare fixture_id uuid;
declare checked_season_id uuid;
declare checked_date date;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('matches.edit') then
    raise exception 'Solo el owner puede modificar partidos entre equipos del club';
  end if;
  select internal_fixture_id, season_id into fixture_id, checked_season_id from public.matches where id = checked_match_id;
  if fixture_id is null then raise exception 'El partido no pertenece a un derbi'; end if;
  checked_date := (checked_values->>'match_date')::date;
  perform 1 from public.matches where internal_fixture_id = fixture_id order by id for update;
  if (select count(*) from public.matches where internal_fixture_id = fixture_id) <> 2 then raise exception 'El derbi está incompleto'; end if;
  if (checked_values->>'season_id')::uuid <> checked_season_id or (checked_values->>'match_kind') is distinct from 'official' then
    raise exception 'No se puede cambiar la temporada ni el tipo de un derbi';
  end if;
  if not exists (select 1 from public.seasons where id = checked_season_id and checked_date between start_date and end_date) then
    raise exception 'La fecha no pertenece a la temporada';
  end if;
  if exists (select 1 from public.matches where internal_fixture_id = fixture_id and lineup_published and
    (match_date <> checked_date or rugby_format::text <> checked_values->>'rugby_format')) then
    raise exception 'Desbloquea las convocatorias antes de cambiar la fecha o el formato';
  end if;
  if exists (
    select 1 from public.matches match where match.internal_fixture_id = fixture_id
      and (match.match_date <> checked_date or match.rugby_format::text <> checked_values->>'rugby_format')
      and (exists (select 1 from public.match_lineup lineup where lineup.match_id = match.id)
        or exists (select 1 from public.match_availability availability where availability.match_id = match.id))
  ) then raise exception 'Borra las propuestas y disponibilidades antes de cambiar la fecha o el formato'; end if;
  perform set_config('app.internal_fixture_write', 'yes', true);
  update public.matches set competition_id = (checked_values->>'competition_id')::uuid,
    match_date = checked_date, kickoff_time = nullif(checked_values->>'kickoff_time', '')::time,
    venue = nullif(checked_values->>'venue', ''), callup_time = nullif(checked_values->>'callup_time', '')::time,
    callup_venue = nullif(checked_values->>'callup_venue', ''), notes = nullif(checked_values->>'notes', ''),
    status = (checked_values->>'status')::public.match_status, rugby_format = (checked_values->>'rugby_format')::public.rugby_format
  where internal_fixture_id = fixture_id;
end;
$$;

create or replace function public.delete_internal_match(checked_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare fixture_id uuid;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('matches.delete') then
    raise exception 'Solo el owner puede borrar partidos entre equipos del club';
  end if;
  select internal_fixture_id into fixture_id from public.matches where id = checked_match_id;
  if fixture_id is null then raise exception 'El partido no pertenece a un derbi'; end if;
  perform set_config('app.internal_fixture_write', 'yes', true);
  delete from public.matches where internal_fixture_id = fixture_id;
end;
$$;

-- Cada entrenador guarda el borrador de su equipo. Se permiten propuestas
-- coincidentes dentro del derbi; el owner debe resolverlas antes de publicar.
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
    where membership.season_team_id is distinct from match.team_id and coalesce(team.is_mixed, false) = false
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

create or replace function public.finalize_internal_match(checked_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare fixture_id uuid;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('matches.lineup_publish') then
    raise exception 'Solo el owner puede publicar ambas convocatorias';
  end if;
  select internal_fixture_id into fixture_id from public.matches where id = checked_match_id;
  if fixture_id is null then raise exception 'El partido no pertenece a un derbi'; end if;
  perform 1 from public.matches where internal_fixture_id = fixture_id order by id for update;
  if (select count(*) from public.matches where internal_fixture_id = fixture_id and status = 'published') <> 2 then
    raise exception 'Publica primero las dos fichas del partido';
  end if;
  if exists (select 1 from public.match_lineup lineup join public.matches match on match.id = lineup.match_id
    where match.internal_fixture_id = fixture_id group by lineup.player_id having count(*) > 1) then
    raise exception 'Resuelve las jugadoras propuestas en ambas convocatorias';
  end if;
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

create or replace function public.unlock_match_lineup(checked_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare fixture_id uuid;
begin
  select internal_fixture_id into fixture_id from public.matches where id = checked_match_id;
  if not found then raise exception 'No se ha encontrado el partido'; end if;
  if fixture_id is not null then
    if not public.current_user_is_owner() or not public.current_user_has_permission('matches.lineup_unlock') then
      raise exception 'Solo el owner puede desbloquear ambas convocatorias';
    end if;
    perform set_config('app.internal_fixture_write', 'yes', true);
    update public.matches set lineup_published = false where internal_fixture_id = fixture_id;
  else
    if not public.current_user_can_edit_match(checked_match_id) or not public.current_user_has_permission('matches.lineup_unlock') then
      raise exception 'No tienes permiso para desbloquear esta convocatoria';
    end if;
    update public.matches set lineup_published = false where id = checked_match_id and lineup_published;
  end if;
end;
$$;

-- Una jugadora solo consulta la ficha de su equipo, o la del equipo al que
-- haya sido finalmente convocada. Los borradores siguen ocultos.
create or replace function public.player_can_access_match(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches match
    join public.season_players membership on membership.season_id = match.season_id and membership.player_id = checked_player_id
    join public.profiles player on player.id = checked_player_id
    where match.id = checked_match_id and match.status <> 'draft'
      and player.is_approved and player.is_active and not player.is_archived and player.is_player
      and membership.active_from <= match.match_date and (membership.active_until is null or membership.active_until >= match.match_date)
      and not public.player_has_absence_on(checked_player_id, match.match_date)
      and (match.internal_fixture_id is null or exists (
        select 1 from public.match_lineup lineup where lineup.match_id = match.id and lineup.player_id = checked_player_id and match.lineup_published
      ) or ((membership.season_team_id = match.team_id or exists (
        select 1 from public.season_teams mixed where mixed.id = membership.season_team_id and mixed.is_mixed
      )) and not exists (
        select 1 from public.matches paired join public.match_lineup other_lineup on other_lineup.match_id = paired.id
        where paired.internal_fixture_id = match.internal_fixture_id and paired.id <> match.id
          and paired.lineup_published and other_lineup.player_id = checked_player_id
      )))
  );
$$;

revoke all on function public.create_internal_match(jsonb,uuid,uuid), public.update_internal_match(uuid,jsonb),
  public.delete_internal_match(uuid), public.finalize_internal_match(uuid) from public;
grant execute on function public.create_internal_match(jsonb,uuid,uuid), public.update_internal_match(uuid,jsonb),
  public.delete_internal_match(uuid), public.finalize_internal_match(uuid) to authenticated;

-- Los borradores y las respuestas de disponibilidad de cada lado solo se leen
-- dentro del equipo asignado. Dirección conserva la consulta publicada.
drop policy if exists "Players and staff can read availability" on public.match_availability;
create policy "Scoped staff and players can read availability" on public.match_availability for select to authenticated using (
  (player_id = (select auth.uid()) and (select public.current_user_has_permission('matches.availability_own')))
  or ((select public.current_user_has_permission('matches.availability_team')) and exists (
    select 1 from public.matches match where match.id = match_id and (
      (select public.current_user_is_owner()) or public.current_user_can_view_season_team(match.team_id)
      or (match.status <> 'draft' and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_viewer))
    )
  ))
);
drop policy if exists "Staff and selected players can read lineups" on public.match_lineup;
create policy "Scoped staff and selected players can read lineups" on public.match_lineup for select to authenticated using (
  ((select public.current_user_has_permission('matches.lineup_edit')) and public.current_user_can_edit_match(match_id))
  or ((select public.current_user_has_permission('matches.lineup_view')) and exists (
    select 1 from public.matches match where match.id = match_id and match.lineup_published
      and (public.player_can_access_match(match_id, (select auth.uid()))
        or (select public.current_user_is_owner()) or public.current_user_can_view_season_team(match.team_id)
        or exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_viewer))
  ))
);

-- La escritura directa saltaría la comprobación de reservas y el cierre conjunto.
revoke insert, update, delete on table public.match_lineup from authenticated;

-- El owner puede confirmar la disponibilidad de una jugadora prestada antes de
-- proponerla en el otro equipo. El entrenador mantiene su ámbito propio/mixto.
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
      and (public.current_user_is_owner() or membership.season_team_id = checked_match.team_id or coalesce(team.is_mixed, false))
  ) then raise exception 'La jugadora no pertenece a un equipo permitido para esta convocatoria'; end if;
  insert into public.match_availability (match_id, player_id, status, comment)
  values (checked_match_id, checked_player_id, checked_status, normalized_comment)
  on conflict (match_id, player_id) do update set status = excluded.status, comment = excluded.comment;
  insert into public.match_availability_coach_changes (match_id, player_id, changed_by, status, comment)
  values (checked_match_id, checked_player_id, (select auth.uid()), checked_status, normalized_comment);
end;
$$;
