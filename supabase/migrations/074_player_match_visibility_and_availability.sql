-- Ejecutar después de 073_player_positions.sql en el SQL Editor de Supabase.
-- Lectura entre equipos para todas las jugadoras vinculadas; respuestas solo con ficha deportiva.
begin;

-- La consulta conserva los periodos de temporada y los estados de perfil.
-- Equipo, ficha y bajas deportivas no ocultan partidos ni convocatorias publicadas.
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
  );
$$;

revoke all on function public.player_can_access_match(uuid,uuid) from public,anon;
grant execute on function public.player_can_access_match(uuid,uuid) to authenticated;

-- Elegibilidad de disponibilidad separada de la elegibilidad de convocatoria.
-- El histórico conserva la ficha que existía en la fecha del partido.
create function public.player_license_allows_availability(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches match
    join public.season_player_licenses license on license.season_id = match.season_id and license.player_id = checked_player_id
    cross join lateral (
      select case when match.status <> 'completed' and match.match_date >= (pg_catalog.now() at time zone 'Europe/Madrid')::date
        then license.license_type
        else coalesce((select history.license_type from public.player_license_history history
          where history.season_id = match.season_id and history.player_id = checked_player_id
            and history.changed_at <= least((match.match_date + coalesce(match.kickoff_time, time '23:59:59')) at time zone 'Europe/Madrid',
              coalesce(match.completed_at,'infinity'::timestamptz))
          order by history.changed_at desc,history.id desc limit 1),'none') end as license_type
    ) effective
    where match.id = checked_match_id
      and effective.license_type in ('regional','national')
      and public.player_license_allows_match(checked_match_id,checked_player_id)
  );
$$;

create or replace function public.guard_match_player_license()
returns trigger language plpgsql security definer set search_path = '' as $$
declare checked_match public.matches%rowtype;
begin
  select * into checked_match from public.matches where id = new.match_id;
  if tg_table_name = 'match_availability' and checked_match.status <> 'published' then
    raise exception 'El partido no está abierto para registrar disponibilidad';
  end if;
  perform 1 from public.season_players membership where membership.season_id = checked_match.season_id
    and membership.player_id = new.player_id order by membership.id for share;
  -- Ver un partido de otro equipo no equivale a poder responder o jugarlo.
  if tg_table_name = 'match_availability' then
    if not public.player_can_access_match(new.match_id,new.player_id)
      or not exists (select 1 from public.season_player_licenses license
        where license.season_id = checked_match.season_id and license.player_id = new.player_id
          and license.license_type in ('regional','national'))
      or not public.player_license_allows_availability(new.match_id,new.player_id) then
      raise exception 'Para responder disponibilidad necesitas ficha Regional o Nacional válida para este partido';
    end if;
    if public.player_has_absence_on(new.player_id,checked_match.match_date) then
      raise exception 'La jugadora está de baja en esta fecha';
    end if;
    if checked_match.internal_fixture_id is not null and exists (
      select 1 from public.matches paired
      join public.match_lineup other_lineup on other_lineup.match_id = paired.id
      where paired.internal_fixture_id = checked_match.internal_fixture_id and paired.id <> checked_match.id
        and paired.lineup_published and other_lineup.player_id = new.player_id
    ) then raise exception 'La jugadora ya está convocada en el otro equipo del derbi'; end if;
  -- Los resultados pasados pueden corregirse sin aplicar la ficha actual.
  elsif checked_match.status <> 'completed' and not public.player_license_allows_match(new.match_id,new.player_id) then
    raise exception 'La ficha de la jugadora no permite participar en este partido';
  end if;
  return new;
end;
$$;

revoke all on function public.player_license_allows_availability(uuid,uuid),
  public.guard_match_player_license() from public,anon,authenticated;

-- Los porcentajes de respuesta excluyen también amistosos sin ficha deportiva.
-- No se borran disponibilidades ni convocatorias históricas.
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
          and public.player_license_allows_availability(m.id,p.id)
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
          and public.player_license_allows_availability(m.id,p.id)
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

revoke all on function public.get_season_callup_report(uuid),public.get_player_season_summary(uuid,uuid) from public,anon;
grant execute on function public.get_season_callup_report(uuid),public.get_player_season_summary(uuid,uuid) to authenticated;

commit;
