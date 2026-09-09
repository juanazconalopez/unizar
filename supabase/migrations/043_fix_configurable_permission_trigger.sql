-- The configurable-permission trigger is shared by tables with different
-- row shapes. Access table-specific NEW/OLD fields only after narrowing the
-- table name; SQL expressions do not guarantee short-circuit evaluation.
create or replace function public.enforce_configurable_permission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  required_permission text;
  availability_player_id uuid;
begin
  if tg_table_name = 'match_availability' then
    if tg_op = 'DELETE' then
      availability_player_id := old.player_id;
    else
      availability_player_id := new.player_id;
    end if;
    required_permission := case
      when availability_player_id = (select auth.uid()) then 'matches.availability_own'
      else 'matches.availability_edit'
    end;
  else
    required_permission := case tg_table_name
      when 'tasks' then case tg_op when 'INSERT' then 'tasks.create' when 'UPDATE' then 'tasks.edit' else 'tasks.delete' end
      when 'team_announcements' then case tg_op when 'INSERT' then 'announcements.create' when 'UPDATE' then 'announcements.edit' else 'announcements.delete' end
      when 'matches' then case tg_op when 'INSERT' then 'matches.create' when 'UPDATE' then 'matches.edit' else 'matches.delete' end
      when 'training_sessions' then 'attendance.record'
      when 'training_attendance' then 'attendance.record'
      when 'provisional_training_attendance' then 'attendance.guests'
      when 'provisional_players' then 'attendance.guests'
      when 'training_plans' then case tg_op when 'INSERT' then 'training.create' when 'UPDATE' then 'training.edit' else 'training.delete' end
      when 'training_exercises' then case tg_op when 'INSERT' then 'training.create' when 'UPDATE' then 'training.edit' else null end
      when 'training_exercise_presets' then case tg_op when 'INSERT' then 'exercises.create' when 'UPDATE' then 'exercises.edit' else 'exercises.delete' end
      when 'match_lineup' then 'matches.lineup_edit'
      when 'task_results' then 'tasks.submit_own'
      else null
    end;
  end if;

  if required_permission is not null and not public.current_user_has_permission(required_permission) then
    raise exception 'No tienes el permiso necesario: %', required_permission;
  end if;

  if tg_table_name = 'tasks' then
    if tg_op = 'UPDATE' then
      if new.status is distinct from old.status and not public.current_user_has_permission('tasks.publish') then
        raise exception 'No tienes permiso para publicar tareas';
      end if;
    elsif tg_op = 'INSERT' then
      if new.status <> 'draft' and not public.current_user_has_permission('tasks.publish') then
        raise exception 'No tienes permiso para publicar tareas';
      end if;
    end if;
  elsif tg_table_name = 'team_announcements' then
    if tg_op = 'UPDATE' then
      if new.status is distinct from old.status and not public.current_user_has_permission('announcements.publish') then
        raise exception 'No tienes permiso para publicar avisos';
      end if;
    elsif tg_op = 'INSERT' then
      if new.status <> 'draft' and not public.current_user_has_permission('announcements.publish') then
        raise exception 'No tienes permiso para publicar avisos';
      end if;
    end if;
  elsif tg_table_name = 'training_plans' then
    if tg_op = 'UPDATE' then
      if new.status is distinct from old.status and not public.current_user_has_permission('training.publish') then
        raise exception 'No tienes permiso para publicar entrenamientos';
      end if;
    elsif tg_op = 'INSERT' then
      if new.status <> 'draft' and not public.current_user_has_permission('training.publish') then
        raise exception 'No tienes permiso para publicar entrenamientos';
      end if;
    end if;
  elsif tg_table_name = 'training_exercises' and tg_op = 'DELETE' then
    if not (public.current_user_has_permission('training.edit') or public.current_user_has_permission('training.delete')) then
      raise exception 'No tienes permiso para eliminar ejercicios del entrenamiento';
    end if;
  elsif tg_table_name = 'matches' then
    if tg_op = 'UPDATE' then
      if new.lineup_published is distinct from old.lineup_published then
        if new.lineup_published and not public.current_user_has_permission('matches.lineup_publish') then
          raise exception 'No tienes permiso para publicar convocatorias';
        end if;
        if not new.lineup_published and not public.current_user_has_permission('matches.lineup_unlock') then
          raise exception 'No tienes permiso para desbloquear convocatorias';
        end if;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.enforce_configurable_permission() from public;
