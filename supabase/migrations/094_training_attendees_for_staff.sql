-- Ejecutar después de 093_internal_match_report_guard.sql en el editor SQL de Supabase.
-- Permite que el staff autorizado vea solo los nombres de quienes han confirmado.
create function public.get_training_plan_attendees(checked_plan_id uuid)
returns table(display_name text)
language plpgsql stable security definer set search_path = '' as $$
declare checked_plan public.training_plans%rowtype;
begin
  if not public.current_user_has_permission('training.view') or not exists (
    select 1 from public.profiles staff
    where staff.id = auth.uid()
      and (staff.is_owner or staff.is_coach)
      and staff.is_approved and staff.is_active and not staff.is_archived
  ) then
    raise exception 'No tienes permiso para consultar las respuestas del entrenamiento';
  end if;

  select plan.* into checked_plan
  from public.training_plans plan
  where plan.id = checked_plan_id;
  if not found then raise exception 'El entrenamiento no existe'; end if;

  return query
  select player.display_name
  from public.training_responses response
  join public.profiles player on player.id = response.player_id
  where response.training_plan_id = checked_plan.id
    and response.attending
    and response.schedule_version = checked_plan.schedule_version
    and checked_plan.status <> 'cancelled'::public.task_status
    and not exists (
      select 1 from public.season_holidays holiday
      where holiday.season_id = checked_plan.season_id and holiday.holiday_date = checked_plan.session_date
    )
    and public.training_player_eligible(checked_plan.season_id, checked_plan.session_date, response.player_id)
  order by lower(player.display_name), player.display_name;
end;
$$;
revoke all on function public.get_training_plan_attendees(uuid) from public, anon;
grant execute on function public.get_training_plan_attendees(uuid) to authenticated;

notify pgrst, 'reload schema';
