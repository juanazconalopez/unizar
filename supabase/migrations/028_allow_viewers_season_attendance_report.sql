-- Una migración ya aplicada no vuelve a ejecutarse cuando se edita su archivo.
-- Reemplaza explícitamente la función para permitir el informe a todos los
-- roles con acceso de lectura al equipo: owner, entrenador y Dirección.
create or replace function public.get_season_attendance_report(checked_season_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_can_view_team_data() then
    raise exception 'No tienes permiso para consultar la asistencia acumulada';
  end if;

  return public.get_season_callup_report(checked_season_id);
end;
$$;

revoke all on function public.get_season_attendance_report(uuid) from public;
grant execute on function public.get_season_attendance_report(uuid) to authenticated;
