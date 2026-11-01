-- Ejecutar completa después de 095 en el editor SQL de Supabase.
-- Las jugadoras vinculadas consultan únicamente nombres de respuestas afirmativas vigentes.
begin;

insert into public.permission_definitions
(key,section_key,section_label,label,description,action,parent_key,sort_order,configurable,owner_only) values
('calendar.training_attendees','calendar','Calendario','Ver quién asistirá a entrenamientos',
 'Consultar los nombres de quienes han respondido Asistiré en entrenamientos a los que estás vinculada.',
 'view','calendar.training_view',127,true,false);
insert into public.role_permission_defaults(role,permission_key) values ('player','calendar.training_attendees');
insert into public.role_permissions(role,permission_key) values ('player','calendar.training_attendees');

create or replace function public.get_training_plan_attendees(checked_plan_id uuid)
returns table(display_name text)
language plpgsql stable security definer set search_path = '' as $$
declare checked_plan public.training_plans%rowtype;
begin
  select plan.* into checked_plan
  from public.training_plans plan
  where plan.id = checked_plan_id;
  if not found then raise exception 'El entrenamiento no existe'; end if;

  if not (
    (public.current_user_has_permission('training.view') and exists (
      select 1 from public.profiles staff
      where staff.id = auth.uid()
        and (staff.is_owner or staff.is_coach)
        and staff.is_approved and staff.is_active and not staff.is_archived
    ))
    or (public.current_user_has_permission('calendar.training_attendees')
      and public.training_player_eligible(checked_plan.season_id, checked_plan.session_date, auth.uid()))
  ) then
    raise exception 'No tienes permiso para consultar las respuestas del entrenamiento';
  end if;

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

commit;
