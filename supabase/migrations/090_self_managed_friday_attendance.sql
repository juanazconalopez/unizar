-- Ejecutar completa después de 089 en Supabase web con el rol postgres.
-- Los viernes nuevos/pendientes son autogestionados. No se reescribe asistencia histórica.
-- Instalación de Cron: https://supabase.com/docs/guides/cron/install
begin;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table public.training_plans add column self_managed boolean not null default false;
alter table public.training_sessions
  add column self_managed boolean not null default false,
  add column training_plan_id uuid unique references public.training_plans(id) on delete set null;

-- Cambio de metadatos de mantenimiento, dentro de esta transacción y sin variar fechas.
alter table public.training_plans disable trigger enforce_configurable_permission;
update public.training_plans p set self_managed=true
where extract(isodow from p.session_date)=5
  and p.session_date >= (clock_timestamp() at time zone 'Europe/Madrid')::date
  and not exists(select 1 from public.training_sessions ts where ts.session_date=p.session_date);
alter table public.training_plans enable trigger enforce_configurable_permission;
create index training_plans_self_managed_date_idx on public.training_plans(session_date) where self_managed;

-- Un cliente autenticado no puede abrir este contexto mediante una variable de sesión.
-- Solo conexiones internas de administración, sin JWT ni SET ROLE de cliente.
create function public.self_managed_attendance_write_allowed(checked_plan_id uuid,checked_date date)
returns boolean language sql volatile security definer set search_path = '' as $$
 select session_user in ('postgres','supabase_admin')
   and coalesce(current_setting('role',true),'none') in ('none','postgres','supabase_admin')
   and auth.uid() is null
   and current_setting('app.self_managed_attendance_plan',true)=checked_plan_id::text
   and exists(select 1 from public.training_plans p where p.id=checked_plan_id
     and p.session_date=checked_date and p.self_managed and extract(isodow from p.session_date)=5
     and p.status <> 'cancelled' and (p.session_date+p.end_time) at time zone 'Europe/Madrid' <= clock_timestamp()
     and not exists(select 1 from public.season_holidays h where h.season_id=p.season_id and h.holiday_date=p.session_date));
$$;
revoke all on function public.self_managed_attendance_write_allowed(uuid,date) from public,anon,authenticated;

create or replace function public.enforce_configurable_permission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  required_permission text;
  availability_player_id uuid;
  automatic_session public.training_sessions;
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'training_sessions' then
      if new.self_managed and public.self_managed_attendance_write_allowed(new.training_plan_id,new.session_date) then return new; end if;
    elsif tg_table_name = 'training_attendance' then
      select * into automatic_session from public.training_sessions where id=new.session_id;
      if automatic_session.self_managed and public.self_managed_attendance_write_allowed(automatic_session.training_plan_id,automatic_session.session_date) then return new; end if;
    end if;
  end if;
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

create or replace function public.guard_training_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'training_sessions' then
    if new.self_managed and public.self_managed_attendance_write_allowed(new.training_plan_id,new.session_date) then
      perform public.lock_training_date(new.session_date);
      return new;
    end if;
    if not public.current_user_has_permission('attendance.record') or not exists(select 1 from public.profiles p
      where p.id=auth.uid() and (p.is_owner or p.is_coach) and p.is_approved and p.is_active and not p.is_archived) then
      raise exception 'No tienes permiso para registrar asistencia';
    end if;
    if new.session_date > (clock_timestamp() at time zone 'Europe/Madrid')::date then
      raise exception 'La asistencia real no se puede guardar para una fecha futura';
    end if;
    perform public.lock_training_date(new.session_date);
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.self_managed and (old.session_date+old.end_time) at time zone 'Europe/Madrid' <= clock_timestamp()
      and exists(select 1 from public.seasons where id=old.season_id) then
      raise exception 'El entrenamiento autogestionado ya ha terminado y conserva su histórico';
    end if;
    perform public.lock_training_date(old.session_date);
    if exists(select 1 from public.training_sessions where session_date = old.session_date)
      and exists(select 1 from public.seasons where id=old.season_id) then
      raise exception 'La asistencia ya está guardada. Conserva el entrenamiento para mantener su histórico';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    -- Orden estable si se mueve una sesión entre fechas.
    perform public.lock_training_date(least(old.session_date,new.session_date));
    perform public.lock_training_date(greatest(old.session_date,new.session_date));
    if (new.session_date,new.start_time,new.end_time,new.season_id) is distinct from
       (old.session_date,old.start_time,old.end_time,old.season_id) then
      if exists(select 1 from public.training_sessions where session_date in (old.session_date,new.session_date)) then
        raise exception 'No se puede mover una sesión con asistencia ya registrada';
      end if;
      if old.self_managed and (old.session_date+old.end_time) at time zone 'Europe/Madrid' <= clock_timestamp() then
        raise exception 'El entrenamiento autogestionado ya ha terminado y conserva su histórico';
      end if;
      new.self_managed := extract(isodow from new.session_date)=5;
      new.schedule_version := old.schedule_version + 1;
    else
      new.self_managed := old.self_managed;
      new.schedule_version := old.schedule_version;
    end if;
  else
    perform public.lock_training_date(new.session_date);
    new.self_managed := extract(isodow from new.session_date)=5;
    new.schedule_version := 1;
  end if;
  if not exists(select 1 from public.seasons s where s.id = new.season_id
    and new.session_date between s.start_date and s.end_date) then
    raise exception 'La fecha no pertenece a la temporada seleccionada';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_training_schedule() from public,anon,authenticated;

-- No se valida manualmente una sesión autogestionada, ni se alteran sus respuestas al cerrar.
create function public.guard_self_managed_training_attendance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare session_row public.training_sessions; plan_id uuid; attendance_date date;
begin
 if tg_table_name='training_sessions' then
   if tg_op='DELETE' then session_row:=old; else session_row:=new; end if;
   plan_id:=session_row.training_plan_id; attendance_date:=session_row.session_date;
 else
   if tg_op='DELETE' then select * into session_row from public.training_sessions where id=old.session_id;
   else select * into session_row from public.training_sessions where id=new.session_id; end if;
   plan_id:=session_row.training_plan_id; attendance_date:=session_row.session_date;
 end if;
 if tg_op='INSERT' and session_row.self_managed and public.self_managed_attendance_write_allowed(plan_id,attendance_date) then return new; end if;
 -- Permitir las cascadas de eliminación de una temporada, conservando sus reglas existentes.
 if session_row.season_id is not null and not exists(select 1 from public.seasons where id=session_row.season_id) then
   if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if session_row.self_managed or exists(select 1 from public.training_plans p where p.session_date=attendance_date and p.self_managed) then
   raise exception 'Los viernes autogestionados registran la asistencia automáticamente; no requieren validación del staff';
 end if;
 if tg_op='UPDATE' then
   if tg_table_name='training_sessions' then
     if old.self_managed then raise exception 'La asistencia autogestionada ya está cerrada'; end if;
   else
     if exists(select 1 from public.training_sessions ts where ts.id=old.session_id and ts.self_managed) then
       raise exception 'La asistencia autogestionada ya está cerrada';
     end if;
   end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function public.guard_self_managed_training_attendance() from public,anon,authenticated;
create trigger a_guard_self_managed before insert or update or delete on public.training_sessions
for each row execute function public.guard_self_managed_training_attendance();
create trigger a_guard_self_managed before insert or update or delete on public.training_attendance
for each row execute function public.guard_self_managed_training_attendance();
create trigger a_guard_self_managed before insert or update or delete on public.provisional_training_attendance
for each row execute function public.guard_self_managed_training_attendance();

create function public.finalize_self_managed_training_attendance()
returns integer language plpgsql security definer set search_path = '' as $$
declare p public.training_plans; season_row public.seasons; saved_session_id uuid; saved_count integer:=0;
begin
 if session_user not in ('postgres','supabase_admin') or auth.uid() is not null
   or coalesce(current_setting('role',true),'none') not in ('none','postgres','supabase_admin') then
   raise exception 'El registro automático solo se ejecuta desde el proceso interno';
 end if;
 -- Bloquear primero la temporada, como la generación y la edición de festivos.
 -- Evita que cambie el cierre del campo a mitad del registro automático.
 for season_row in select season.* from public.seasons season
   where exists(select 1 from public.training_plans pending where pending.season_id=season.id
     and pending.self_managed and (pending.session_date+pending.end_time) at time zone 'Europe/Madrid' <= clock_timestamp()
     and pending.status <> 'cancelled'
     and not exists(select 1 from public.training_sessions ts where ts.session_date=pending.session_date))
   order by season.id for share of season loop
 for p in select plan.* from public.training_plans plan
   where plan.season_id=season_row.id and plan.self_managed and extract(isodow from plan.session_date)=5 and plan.status <> 'cancelled'
     and (plan.session_date+plan.end_time) at time zone 'Europe/Madrid' <= clock_timestamp()
     and not exists(select 1 from public.season_holidays h where h.season_id=plan.season_id and h.holiday_date=plan.session_date)
     and not exists(select 1 from public.training_sessions ts where ts.session_date=plan.session_date)
   order by plan.session_date,plan.id for update of plan skip locked loop
   perform public.lock_training_date(p.session_date);
   perform set_config('app.self_managed_attendance_plan',p.id::text,true);
   insert into public.training_sessions(session_date,season_id,created_by,self_managed,training_plan_id)
   values(p.session_date,p.season_id,p.created_by,true,p.id)
   on conflict(session_date) do nothing returning id into saved_session_id;
   if saved_session_id is not null then
     insert into public.training_attendance(session_id,player_id,attended,marked_by)
     select saved_session_id,player.id,coalesce(response.attending and response.schedule_version=p.schedule_version,false),
       coalesce(response.player_id,p.created_by)
     from public.profiles player
     left join public.training_responses response on response.training_plan_id=p.id and response.player_id=player.id
     where public.training_player_eligible(p.season_id,p.session_date,player.id);
     saved_count:=saved_count+1;
   end if;
   perform set_config('app.self_managed_attendance_plan','',true);
 end loop;
 end loop;
 return saved_count;
end;
$$;
revoke all on function public.finalize_self_managed_training_attendance() from public,anon,authenticated;
grant execute on function public.finalize_self_managed_training_attendance() to postgres;

drop function public.get_training_calendar(date,date);
create function public.get_training_calendar(from_date date,until_date date)
returns table(id uuid,session_date date,title text,status public.task_status,start_time time,end_time time,
 schedule_version integer,own_attending boolean,own_comment text,response_stale boolean,responses_closed boolean,attendance_recorded boolean,attending_count integer,self_managed boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not (public.current_user_has_permission('training.view') or public.current_user_has_permission('calendar.training_view')) then
   raise exception 'No tienes permiso para consultar entrenamientos';
 end if;
 if from_date is null or until_date is null or until_date < from_date or until_date - from_date > 62 then
   raise exception 'Consulta como máximo dos meses de entrenamientos';
 end if;
 return query select p.id,p.session_date,p.title,p.status,p.start_time,p.end_time,p.schedule_version,
   case when r.schedule_version = p.schedule_version then r.attending end,
   case when r.schedule_version = p.schedule_version then r.comment end,
   coalesce(r.schedule_version <> p.schedule_version,false),
   p.status = 'cancelled' or (p.session_date+p.end_time) at time zone 'Europe/Madrid' <= now()
     or exists(select 1 from public.training_sessions ts where ts.session_date=p.session_date)
     or exists(select 1 from public.season_holidays h where h.season_id=p.season_id and h.holiday_date=p.session_date),
   exists(select 1 from public.training_sessions ts where ts.session_date=p.session_date),
   case when p.status = 'cancelled' or exists(select 1 from public.season_holidays h
     where h.season_id=p.season_id and h.holiday_date=p.session_date) then 0
   else (select count(*)::integer from public.training_responses confirmed
     where confirmed.training_plan_id=p.id and confirmed.attending
       and confirmed.schedule_version=p.schedule_version
       and public.training_player_eligible(p.season_id,p.session_date,confirmed.player_id)) end,p.self_managed
 from public.training_plans p left join public.training_responses r on r.training_plan_id=p.id and r.player_id=auth.uid()
 where p.session_date between from_date and until_date
   and (public.current_user_has_permission('training.view') or public.training_player_eligible(p.season_id,p.session_date,auth.uid()))
 order by p.session_date,p.id;
end;
$$;
revoke all on function public.get_training_calendar(date,date) from public,anon;
grant execute on function public.get_training_calendar(date,date) to authenticated;


create or replace function public.get_training_attendance_basis(checked_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.current_user_has_permission('attendance.record') or not exists(select 1 from public.profiles p
   where p.id=auth.uid() and (p.is_owner or p.is_coach) and p.is_approved and p.is_active and not p.is_archived) then
   raise exception 'No tienes permiso para registrar asistencia';
 end if;
 return jsonb_build_object(
   'self_managed',exists(select 1 from public.training_plans p where p.session_date=checked_date and p.self_managed)
     or exists(select 1 from public.training_sessions ts where ts.session_date=checked_date and ts.self_managed),
   'recorded',exists(select 1 from public.training_sessions ts where ts.session_date=checked_date),
   'attended_player_ids',coalesce((select jsonb_agg(a.player_id) from public.training_attendance a
     join public.training_sessions ts on ts.id=a.session_id where ts.session_date=checked_date and a.attended),'[]'::jsonb),
   'responses',coalesce((select jsonb_agg(jsonb_build_object('player_id',r.player_id,'attending',r.attending,'comment',r.comment))
     from public.training_responses r join public.training_plans p on p.id=r.training_plan_id
     where p.session_date=checked_date and p.status <> 'cancelled' and r.schedule_version=p.schedule_version
       and not exists(select 1 from public.season_holidays h where h.season_id=p.season_id and h.holiday_date=p.session_date)
       and public.training_player_eligible(p.season_id,p.session_date,r.player_id)),'[]'::jsonb));
end;
$$;
revoke all on function public.get_training_attendance_basis(date) from public,anon;
grant execute on function public.get_training_attendance_basis(date) to authenticated;


-- Un solo trabajo, sin Edge Functions ni llamadas HTTP. La ventana UTC cubre
-- las 21:30 de Madrid tanto en invierno como en verano y reintenta pendientes.
select cron.schedule('unizar-self-managed-training-attendance','*/5 19-23 * * *',
  'select public.finalize_self_managed_training_attendance();');
-- Recuperar hoy si la migración se aplica después de finalizar el viernes.
select public.finalize_self_managed_training_attendance();
notify pgrst,'reload schema';
commit;
