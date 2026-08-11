-- Evita que PostgreSQL confunda el player_id procedente de unnest con las
-- columnas homónimas de profiles, season_players y training_attendance.
create or replace function public.save_training_attendance(
  attendance_date date,
  checked_player_ids uuid[],
  attended_player_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  checked_session_id uuid;
  checked_season_id uuid;
begin
  if not public.current_user_is_owner() then
    raise exception 'Solo el owner puede guardar asistencia';
  end if;

  select s.id into checked_season_id
  from public.seasons as s
  where attendance_date between s.start_date and s.end_date;

  if checked_season_id is null then
    raise exception 'No hay una temporada que incluya la fecha del entrenamiento';
  end if;

  if exists (
    select 1
    from unnest(checked_player_ids) as selected_player(player_id)
    left join public.profiles as p
      on p.id = selected_player.player_id
    left join public.season_players as sp
      on sp.season_id = checked_season_id
      and sp.player_id = selected_player.player_id
      and sp.active_from <= attendance_date
      and (sp.active_until is null or sp.active_until >= attendance_date)
    where p.id is null or p.is_owner or sp.id is null
  ) then
    raise exception 'La asistencia contiene una jugadora no elegible para esa fecha';
  end if;

  if exists (
    select 1
    from unnest(attended_player_ids) as attended_player(player_id)
    where not (attended_player.player_id = any(checked_player_ids))
  ) then
    raise exception 'Una asistente no forma parte del listado del entrenamiento';
  end if;

  insert into public.training_sessions (session_date, season_id, created_by)
  values (attendance_date, checked_season_id, auth.uid())
  on conflict (session_date) do update
    set season_id = excluded.season_id, updated_at = now()
  returning training_sessions.id into checked_session_id;

  delete from public.training_attendance as ta
  where ta.session_id = checked_session_id
    and not (ta.player_id = any(checked_player_ids));

  insert into public.training_attendance (session_id, player_id, attended, marked_by)
  select
    checked_session_id,
    selected_player.player_id,
    selected_player.player_id = any(attended_player_ids),
    auth.uid()
  from unnest(checked_player_ids) as selected_player(player_id)
  on conflict on constraint training_attendance_pkey do update
    set attended = excluded.attended,
        marked_by = auth.uid(),
        updated_at = now();
end;
$$;

grant execute on function public.save_training_attendance(date, uuid[], uuid[]) to authenticated;
