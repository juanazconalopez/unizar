-- Resumen acumulado de convocatorias y asistencia para el staff autorizado.
-- Se devuelve un agregado acotado para no ampliar el acceso directo a perfiles
-- ni a historiales individuales mediante las políticas RLS.
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
  callups as (
    select
      ml.player_id,
      count(distinct cm.id) filter (where cm.match_kind = 'official'::public.match_kind)::integer as official_callups,
      count(distinct cm.id) filter (where cm.match_kind = 'friendly'::public.match_kind)::integer as friendly_callups,
      count(distinct cm.id) filter (where ml.role = 'starter'::public.lineup_role)::integer as starter_callups,
      count(distinct cm.id) filter (where ml.role = 'substitute'::public.lineup_role)::integer as substitute_callups
    from counted_matches cm
    join public.match_lineup ml on ml.match_id = cm.id
    where exists (
      select 1 from public.season_players sp
      where sp.season_id = checked_season_id
        and sp.player_id = ml.player_id
        and cm.match_date >= sp.active_from
        and (sp.active_until is null or cm.match_date <= sp.active_until)
    )
    group by ml.player_id
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

revoke all on function public.get_season_callup_report(uuid) from public;
grant execute on function public.get_season_callup_report(uuid) to authenticated;

-- Detalle personal reutilizado por Inicio y por el cuerpo técnico desde el
-- acumulado. Una jugadora solo puede consultar su propio resumen.
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
      case when m.lineup_published then ml.role else null end as lineup_role,
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

revoke all on function public.get_player_season_summary(uuid, uuid) from public;
grant execute on function public.get_player_season_summary(uuid, uuid) to authenticated;
