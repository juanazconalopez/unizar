-- Ejecutar completa después de 094 en Supabase web.
-- Conserva Cron y el origen automático; permite corregir un registro ya creado.
begin;

create or replace function public.guard_self_managed_training_attendance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  session_row public.training_sessions;
  stored_session public.training_sessions;
  target_session public.training_sessions;
  automatic_attendance boolean;
begin
  if tg_table_name = 'training_sessions' then
    if tg_op in ('UPDATE', 'DELETE') then session_row := old;
    else session_row := new; end if;
  else
    if tg_op in ('UPDATE', 'DELETE') then
      select * into session_row from public.training_sessions where id = old.session_id;
    else
      select * into session_row from public.training_sessions where id = new.session_id;
    end if;
  end if;

  -- El proceso interno sigue siendo el único que crea el registro automático.
  if tg_op = 'INSERT' and session_row.self_managed
    and public.self_managed_attendance_write_allowed(session_row.training_plan_id, session_row.session_date) then
    return new;
  end if;

  -- Mantener las cascadas al eliminar una temporada, como en 090.
  if session_row.season_id is not null
    and not exists(select 1 from public.seasons where id = session_row.season_id) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  automatic_attendance := session_row.self_managed or exists(
    select 1 from public.training_plans p where p.session_date = session_row.session_date and p.self_managed);

  if tg_table_name = 'training_sessions' then
    if tg_op = 'INSERT' then
      -- save_training_attendance usa INSERT ... ON CONFLICT DO UPDATE.
      -- El BEFORE INSERT recibe los valores manuales antes de actualizar la sesión existente.
      perform public.lock_training_date(new.session_date);
      select * into stored_session from public.training_sessions where session_date = new.session_date;
      automatic_attendance := automatic_attendance or coalesce(stored_session.self_managed, false);
    elsif tg_op = 'UPDATE' then
      automatic_attendance := automatic_attendance or new.self_managed or exists(
        select 1 from public.training_plans p where p.session_date = new.session_date and p.self_managed);
    end if;
  elsif tg_op = 'UPDATE' then
    select * into target_session from public.training_sessions where id = new.session_id;
    automatic_attendance := automatic_attendance or coalesce(target_session.self_managed, false) or exists(
      select 1 from public.training_plans p where p.session_date = target_session.session_date and p.self_managed);
  end if;

  if automatic_attendance then
    if not public.current_user_has_permission('attendance.record') or not exists(
      select 1 from public.profiles staff where staff.id = auth.uid()
        and (staff.is_owner or staff.is_coach) and staff.is_approved and staff.is_active and not staff.is_archived) then
      raise exception 'No tienes permiso para corregir asistencia';
    end if;
    if tg_table_name = 'provisional_training_attendance'
      and not public.current_user_has_permission('attendance.guests') then
      raise exception 'No tienes permiso para gestionar invitadas';
    end if;

    if tg_table_name = 'training_sessions' then
      if tg_op = 'DELETE' then
        raise exception 'El registro automático se conserva; corrige sus asistentes sin eliminarlo';
      elsif tg_op = 'INSERT' then
        if stored_session.id is null or not stored_session.self_managed
          or new.season_id is distinct from stored_session.season_id then
          raise exception 'Espera al registro automático del viernes antes de corregir la asistencia';
        end if;
      elsif not old.self_managed or
        (new.id, new.session_date, new.season_id, new.self_managed, new.training_plan_id, new.created_by, new.created_at)
        is distinct from
        (old.id, old.session_date, old.season_id, old.self_managed, old.training_plan_id, old.created_by, old.created_at) then
        raise exception 'La corrección conserva la fecha, temporada y origen del registro automático';
      end if;
    else
      if not session_row.self_managed then
        raise exception 'Espera al registro automático del viernes antes de corregir la asistencia';
      end if;
      if tg_op = 'UPDATE' and new.session_id is distinct from old.session_id then
        raise exception 'No se puede trasladar asistencia desde o hacia un registro automático';
      end if;
    end if;

    if session_row.session_date > (clock_timestamp() at time zone 'Europe/Madrid')::date then
      raise exception 'La asistencia real no se puede guardar para una fecha futura';
    end if;
    perform public.lock_training_date(session_row.session_date);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_self_managed_training_attendance() from public, anon, authenticated;

-- No se modifica finalize_self_managed_training_attendance: solo procesa fechas
-- sin training_sessions y nunca reemplaza las correcciones de una sesión existente.
notify pgrst, 'reload schema';
commit;
