-- Ejecutar después de 079_unique_fixture_availability_reports.sql en Supabase web.
-- Una oportunidad por equipo/préstamo y viernes-domingo; entre semana, por día.
-- Las respuestas siguen perteneciendo a cada partido. No modifica el histórico.
begin;

create function public.match_participation_window(checked_date date)
returns date language sql immutable set search_path = '' as $$
  select case when extract(isodow from checked_date) >= 5
    then checked_date - (extract(isodow from checked_date)::integer - 5)
    else checked_date end;
$$;

-- Helper privado: no permite consultar respuestas de otras jugadoras desde la API.
create function public.player_availability_opportunities(checked_season_id uuid, checked_player_id uuid)
returns table(match_id uuid, window_start date, availability_status public.availability_status)
language sql stable security definer set search_path = '' as $$
  select distinct on (public.match_participation_window(match.match_date))
    match.id, public.match_participation_window(match.match_date), response.status
  from public.matches match
  join public.season_players membership on membership.season_id = match.season_id
    and membership.player_id = checked_player_id
    and match.match_date >= membership.active_from
    and (membership.active_until is null or match.match_date <= membership.active_until)
  left join public.season_teams team on team.id = membership.season_team_id
  left join public.match_lineup lineup on lineup.match_id = match.id and lineup.player_id = checked_player_id
  left join lateral public.match_fixture_availability(match.id) response on response.player_id = checked_player_id
  where match.season_id = checked_season_id
    and match.status in ('published'::public.match_status, 'completed'::public.match_status)
    and public.player_license_allows_availability(match.id, checked_player_id)
    and (membership.season_team_id = match.team_id or coalesce(team.is_mixed, false)
      or lineup.player_id is not null
      or (match.match_kind = 'friendly' and membership.season_team_id is null and match.team_id is null))
  order by public.match_participation_window(match.match_date),
    (lineup.player_id is not null) desc,
    coalesce(membership.season_team_id = match.team_id, false) desc,
    (response.status is not null) desc,
    match.match_date, match.kickoff_time nulls last, match.is_home desc, match.id;
$$;

-- Titulares y suplentes guardadas reservan aun sin publicar. Los amistosos conservan
-- sus suplentes automáticas, limitadas a la oportunidad efectiva de cada jugadora.
create function public.match_participation_player_ids(checked_match_id uuid)
returns table(player_id uuid) language sql stable security definer set search_path = '' as $$
  select lineup.player_id from public.match_lineup lineup where lineup.match_id = checked_match_id
  union
  select response.player_id from public.matches match
  cross join lateral public.match_fixture_availability(match.id) response
  cross join lateral public.player_availability_opportunities(match.season_id, response.player_id) opportunity
  where match.id = checked_match_id and match.match_kind = 'friendly' and match.lineup_published
    and match.status <> 'cancelled' and response.status = 'available'
    and opportunity.match_id = match.id;
$$;

create function public.get_match_lineup_reservations(checked_match_id uuid)
returns table(player_id uuid, match_id uuid, team_name text, match_date date, is_derby boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('matches.lineup_edit')
    or not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permiso para comprobar las reservas de esta convocatoria';
  end if;
  return query
  select reserved.player_id, other.id, coalesce(team.name, 'Otro equipo'), other.match_date,
    coalesce(target.internal_fixture_id = other.internal_fixture_id, false)
  from public.matches target
  join public.matches other on other.id <> target.id
    and other.status <> 'cancelled'
    and public.match_participation_window(other.match_date) = public.match_participation_window(target.match_date)
  cross join lateral public.match_participation_player_ids(other.id) reserved
  left join public.season_teams team on team.id = other.team_id
  where target.id = checked_match_id
  order by other.match_date, other.id, reserved.player_id;
end;
$$;

-- Bloqueo antes de leer reservas: serializa guardados simultáneos de equipos distintos.
-- No almacena oportunidades ni utiliza Realtime.
create function public.lock_match_participation_window(checked_date date)
returns void language sql volatile security definer set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(80400,
    public.match_participation_window(checked_date) - date '2000-01-01');
$$;

-- También protege las reservas explícitas ante escrituras directas en match_lineup.
-- Las suplentes automáticas del amistoso se derivan de la oportunidad final: durante
-- el DELETE/INSERT atómico de save_match_lineup no deben reaparecer como una reserva
-- nueva que bloquee una jugadora que ya estaba prestada en esta misma convocatoria.
-- La RPC comprueba las reservas efectivas antes de sustituir sus filas.
-- Las coincidencias antiguas del derbi se resuelven antes de publicar ambas fichas.
create function public.guard_match_lineup_participation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype;
begin
  if tg_op = 'DELETE' then
    select * into target from public.matches where id = old.match_id;
    if found then perform public.lock_match_participation_window(target.match_date); end if;
    return old;
  end if;
  select * into target from public.matches where id = new.match_id;
  if target.status in ('completed','cancelled') then return new; end if;
  perform public.lock_match_participation_window(target.match_date);
  if exists (
    select 1 from public.matches other
    join public.match_lineup reserved on reserved.match_id = other.id
    where other.id <> target.id and other.status <> 'cancelled'
      and public.match_participation_window(other.match_date) = public.match_participation_window(target.match_date)
      and reserved.player_id = new.player_id
      and (target.internal_fixture_id is null or other.internal_fixture_id is distinct from target.internal_fixture_id
        or target.lineup_published)
  ) then raise exception 'La jugadora ya está convocada en otro partido del mismo fin de semana o día'; end if;
  return new;
end;
$$;
create trigger match_lineup_participation_guard before insert or update or delete on public.match_lineup
for each row execute function public.guard_match_lineup_participation();

-- Cambiar fecha, restaurar un cancelado o publicar no permite saltarse las reservas.
create function public.guard_match_calendar_participation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('completed','cancelled') then return new; end if;
  if tg_op = 'UPDATE' and (new.match_date,new.season_id,new.status,new.lineup_published)
    is not distinct from (old.match_date,old.season_id,old.status,old.lineup_published) then return new; end if;
  perform public.lock_match_participation_window(new.match_date);
  if exists (
    select 1 from public.match_lineup lineup
    join public.matches other on other.id <> new.id and other.status <> 'cancelled'
    cross join lateral public.match_participation_player_ids(other.id) reserved
    where lineup.match_id = new.id and reserved.player_id = lineup.player_id
      and public.match_participation_window(other.match_date) = public.match_participation_window(new.match_date)
      and (new.internal_fixture_id is null or other.internal_fixture_id is distinct from new.internal_fixture_id
        or new.lineup_published)
  ) then raise exception 'Revisa la convocatoria: hay jugadoras convocadas en otro partido del mismo fin de semana o día'; end if;
  return new;
end;
$$;
create trigger matches_calendar_participation_guard after insert or update on public.matches
for each row execute function public.guard_match_calendar_participation();

create or replace function public.save_match_lineup(checked_match_id uuid, lineup_entries jsonb, publish_lineup boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare maximum_slots integer;
declare starter_slots integer;
declare was_published boolean;
declare checked_date date;
declare fixture_id uuid;
declare locked_window date;
begin
  if not public.current_user_can_edit_match(checked_match_id) or not public.current_user_has_permission('matches.lineup_edit') then
    raise exception 'No tienes permiso para gestionar esta convocatoria';
  end if;
  select case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end, lineup_published, match_date, internal_fixture_id
  into maximum_slots, starter_slots, was_published, checked_date, fixture_id
  from public.matches where id = checked_match_id;
  if not found then raise exception 'El partido no existe'; end if;
  locked_window := public.match_participation_window(checked_date);
  perform public.lock_match_participation_window(checked_date);
  select case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end, lineup_published, match_date, internal_fixture_id
  into maximum_slots, starter_slots, was_published, checked_date, fixture_id
  from public.matches where id = checked_match_id for update;
  if not found then raise exception 'El partido no existe'; end if;
  if public.match_participation_window(checked_date) <> locked_window then
    raise exception 'La fecha del partido ha cambiado. Vuelve a abrir la convocatoria';
  end if;
  if was_published then raise exception 'La convocatoria publicada ya no se puede modificar'; end if;
  if fixture_id is not null and publish_lineup then raise exception 'El owner debe publicar juntas las dos convocatorias'; end if;
  if fixture_id is null and publish_lineup and not public.current_user_has_permission('matches.lineup_publish') then
    raise exception 'No tienes permiso para publicar convocatorias';
  end if;
  if jsonb_typeof(lineup_entries) is distinct from 'array' then raise exception 'La convocatoria debe ser una lista'; end if;
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
    left join lateral public.match_fixture_availability(checked_match_id) availability on availability.match_id = checked_match_id
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
    join public.matches other_match on other_match.id <> checked_match_id
    cross join lateral public.match_participation_player_ids(other_match.id) other_lineup
    where other_lineup.player_id = (entry->>'player_id')::uuid
      and other_match.status <> 'cancelled'
      and public.match_participation_window(other_match.match_date) = public.match_participation_window(checked_date)
      and (fixture_id is null or other_match.internal_fixture_id is distinct from fixture_id)
  ) then raise exception 'Una jugadora ya está reservada en la convocatoria de otro partido del mismo fin de semana o día'; end if;
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
declare checked_date date;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('matches.lineup_publish') then
    raise exception 'Solo el owner puede publicar ambas convocatorias';
  end if;
  select internal_fixture_id, match_date into fixture_id, checked_date from public.matches where id = checked_match_id;
  if fixture_id is null then raise exception 'El partido no pertenece a un derbi'; end if;
  perform public.lock_match_participation_window(checked_date);
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
    join public.matches other_match on other_match.status <> 'cancelled'
    cross join lateral public.match_participation_player_ids(other_match.id) other_lineup
    where match.internal_fixture_id = fixture_id and other_lineup.player_id = lineup.player_id
      and public.match_participation_window(other_match.match_date) = public.match_participation_window(checked_date)
      and other_match.internal_fixture_id is distinct from fixture_id
  ) then raise exception 'Una jugadora ya está reservada en otro partido del mismo fin de semana o día'; end if;
  if exists (
    select 1 from public.match_lineup lineup join public.matches match on match.id = lineup.match_id
    left join lateral public.match_fixture_availability(match.id) availability on availability.match_id = match.id
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
    from counted_matches cm
    cross join lateral public.match_fixture_availability(cm.id) ma
    where cm.match_kind = 'friendly'::public.match_kind
      and ma.status = 'available'::public.availability_status
      and exists (select 1 from public.player_availability_opportunities(checked_season_id, ma.player_id) opportunity
        where opportunity.match_id = cm.id)
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
    left join lateral public.match_fixture_availability(cm.id) ma
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
      (select count(*)::integer from public.player_availability_opportunities(checked_season_id, p.id)) as eligible_matches,
      (select count(*)::integer from public.player_availability_opportunities(checked_season_id, p.id)
        where availability_status is not null) as availability_responded,
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
      and public.player_license_allows_availability(m.id,checked_player_id)
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
      m.internal_fixture_id,
      m.team_id,
      m.match_date,
      m.opponent,
      m.match_kind,
      m.rugby_format,
      m.is_home,
      ma.status as availability_status,
      case when m.match_kind = 'friendly' and ml.role is null
        and not exists (select 1 from public.player_availability_opportunities(checked_season_id, checked_player_id) opportunity
          where opportunity.match_id = m.id) then null
        else public.effective_callup_role(m.match_kind, m.lineup_published, ma.status, ml.role) end as lineup_role,
      case when m.lineup_published then ml.slot_number else null end as slot_number
    from eligible_matches m
    left join lateral public.match_fixture_availability(m.id) ma
      on ma.match_id = m.id and ma.player_id = checked_player_id
    left join public.match_lineup ml
      on ml.match_id = m.id and ml.player_id = checked_player_id
  ),
  fixture_details as (
    select md.* from match_detail md
    join public.player_availability_opportunities(checked_season_id, checked_player_id) opportunity
      on opportunity.match_id = md.id
  ),
  availability_totals as (
    select count(*)::integer as eligible_matches,
      count(*) filter (where availability_status is not null)::integer as availability_responded,
      count(*) filter (where availability_status = 'available')::integer as available,
      count(*) filter (where availability_status = 'doubt')::integer as doubt,
      count(*) filter (where availability_status = 'unavailable')::integer as unavailable
    from public.player_availability_opportunities(checked_season_id, checked_player_id)
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
      'eligibleMatches', av.eligible_matches,
      'responded', av.availability_responded,
      'available', av.available,
      'doubt', av.doubt,
      'unavailable', av.unavailable,
      'unanswered', av.eligible_matches - av.availability_responded,
      'percentage', case when av.eligible_matches = 0 then null
        else round(av.availability_responded * 100.0 / av.eligible_matches)::integer end
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
      from fixture_details md
    ), '[]'::jsonb)
  ) into summary
  from public.seasons s
  join public.profiles p on p.id = checked_player_id
  cross join attendance a
  cross join match_totals mt
  cross join availability_totals av
  where s.id = checked_season_id;

  return summary;
end;
$$;

revoke all on function public.get_season_callup_report(uuid),
  public.get_player_season_summary(uuid,uuid) from public,anon;
grant execute on function public.get_season_callup_report(uuid),
  public.get_player_season_summary(uuid,uuid) to authenticated;

revoke all on function public.match_participation_window(date),
  public.player_availability_opportunities(uuid,uuid), public.match_participation_player_ids(uuid),
  public.lock_match_participation_window(date), public.guard_match_lineup_participation(),
  public.guard_match_calendar_participation() from public,anon,authenticated;
revoke all on function public.get_match_lineup_reservations(uuid) from public,anon;
grant execute on function public.get_match_lineup_reservations(uuid) to authenticated;
-- Las RPC sustituidas conservan su firma y permisos; se declaran explícitamente.
revoke all on function public.save_match_lineup(uuid,jsonb,boolean), public.finalize_internal_match(uuid) from public,anon;
grant execute on function public.save_match_lineup(uuid,jsonb,boolean), public.finalize_internal_match(uuid) to authenticated;

commit;
