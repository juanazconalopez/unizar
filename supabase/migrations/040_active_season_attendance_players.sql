-- La asistencia acumulada de la temporada activa solo incluye jugadoras que
-- siguen aprobadas, activas y no archivadas en el momento de la consulta.
create or replace function public.get_season_attendance_report(checked_season_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
begin
  if not public.current_user_can_view_team_data() then
    raise exception 'No tienes permiso para consultar la asistencia acumulada';
  end if;

  if not exists (select 1 from public.seasons where id = checked_season_id) then
    raise exception 'La temporada no existe';
  end if;

  report := public.get_season_callup_report(checked_season_id);

  return jsonb_set(
    report,
    '{players}',
    coalesce((
      select jsonb_agg(player.value order by player.value->>'name')
      from jsonb_array_elements(coalesce(report->'players', '[]'::jsonb)) as player(value)
      where exists (
        select 1
        from public.profiles p
        join public.season_players sp on sp.player_id = p.id
        where p.id = (player.value->>'playerId')::uuid
          and sp.season_id = checked_season_id
          and p.is_player
          and p.is_approved
          and p.is_active
          and not p.is_archived
      )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_season_attendance_report(uuid) from public;
grant execute on function public.get_season_attendance_report(uuid) to authenticated;
