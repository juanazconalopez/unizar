-- Un owner activo puede figurar como entrenador de un equipo sin asumir el rol is_coach.
create or replace function public.set_season_team_coach(checked_team_id uuid, checked_coach_id uuid, checked_assigned boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede asignar entrenadores a equipos';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = checked_coach_id and (is_coach or is_owner)
      and is_approved and is_active and not is_archived
  ) then raise exception 'La persona seleccionada no es un entrenador u owner activo'; end if;
  if checked_assigned then
    insert into public.season_team_coaches (season_team_id, coach_id)
    values (checked_team_id, checked_coach_id) on conflict do nothing;
  else
    delete from public.season_team_coaches where season_team_id = checked_team_id and coach_id = checked_coach_id;
  end if;
end;
$$;

revoke all on function public.set_season_team_coach(uuid,uuid,boolean) from public;
grant execute on function public.set_season_team_coach(uuid,uuid,boolean) to authenticated;
