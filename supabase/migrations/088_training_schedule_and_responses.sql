-- Ejecutar completa después de 087 en el editor SQL de Supabase.
-- Agenda pública mínima; ejercicios y planes completos siguen siendo privados.
begin;

insert into public.permission_definitions
(key,section_key,section_label,label,description,action,parent_key,sort_order,configurable,owner_only) values
('training.generate','training','Entrenamientos','Generar entrenamientos','Crea los días pendientes de la temporada activa respetando sus festivos.','create','training.create',455,true,false),
('calendar.training_view','calendar','Calendario','Ver entrenamientos','Consultar nombre, fecha, horario y respuesta propia, también en borrador.','view','calendar.view_personal',125,true,false),
('calendar.training_respond','calendar','Calendario','Responder asistencia a entrenamientos','Responder hasta el final de la sesión o el registro de asistencia real.','edit','calendar.training_view',126,true,false);
insert into public.role_permission_defaults(role,permission_key) values
('coach','training.generate'),('player','calendar.training_view'),('player','calendar.training_respond');
insert into public.role_permissions(role,permission_key) values
('coach','training.generate'),('player','calendar.training_view'),('player','calendar.training_respond');

alter table public.training_plans
  add column start_time time not null default time '19:30',
  add column end_time time not null default time '21:30',
  add column schedule_version integer not null default 1,
  add constraint training_plans_time_order check (end_time > start_time),
  add constraint training_plans_version_positive check (schedule_version > 0);

create table public.training_responses (
  training_plan_id uuid not null references public.training_plans(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  attending boolean not null,
  comment text not null default '' check (length(comment) <= 500),
  schedule_version integer not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(training_plan_id,player_id)
);
alter table public.training_responses enable row level security;
revoke all on public.training_responses from public,anon,authenticated;

-- Todos los escritores de asistencia/agenda/respuestas usan el mismo bloqueo por fecha.
create function public.lock_training_date(checked_date date)
returns void language sql volatile set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('training-date:' || pg_catalog.to_char(checked_date,'YYYY-MM-DD'),0));
$$;
revoke all on function public.lock_training_date(date) from public,anon,authenticated;

create function public.guard_training_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'training_sessions' then
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
      new.schedule_version := old.schedule_version + 1;
    else
      new.schedule_version := old.schedule_version;
    end if;
  else
    perform public.lock_training_date(new.session_date);
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
create trigger training_schedule_guard before insert or update or delete on public.training_plans
for each row execute function public.guard_training_schedule();
create trigger training_attendance_date_lock before insert or update on public.training_sessions
for each row execute function public.guard_training_schedule();

create function public.training_player_eligible(checked_season uuid,checked_date date,checked_player uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id = checked_player
   and p.is_player and p.is_approved and p.is_active and not p.is_archived)
 and exists(select 1 from public.season_players sp where sp.player_id = checked_player
   and sp.season_id = checked_season and sp.active_from <= checked_date
   and (sp.active_until is null or sp.active_until >= checked_date));
$$;
revoke all on function public.training_player_eligible(uuid,date,uuid) from public,anon,authenticated;

create function public.get_training_calendar(from_date date,until_date date)
returns table(id uuid,session_date date,title text,status public.task_status,start_time time,end_time time,
 schedule_version integer,own_attending boolean,own_comment text,response_stale boolean,responses_closed boolean,attendance_recorded boolean)
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
   exists(select 1 from public.training_sessions ts where ts.session_date=p.session_date)
 from public.training_plans p left join public.training_responses r on r.training_plan_id=p.id and r.player_id=auth.uid()
 where p.session_date between from_date and until_date
   and (public.current_user_has_permission('training.view') or public.training_player_eligible(p.season_id,p.session_date,auth.uid()))
 order by p.session_date,p.id;
end;
$$;
revoke all on function public.get_training_calendar(date,date) from public,anon;
grant execute on function public.get_training_calendar(date,date) to authenticated;

create function public.save_training_response(checked_plan_id uuid,checked_attending boolean,checked_comment text,checked_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.training_plans;
begin
 if not public.current_user_has_permission('calendar.training_respond') then raise exception 'No tienes permiso para responder'; end if;
 select * into p from public.training_plans where id=checked_plan_id for update;
 if not found then raise exception 'El entrenamiento no existe'; end if;
 perform public.lock_training_date(p.session_date);
 if not public.training_player_eligible(p.season_id,p.session_date,auth.uid()) then raise exception 'No estás vinculada a esta sesión'; end if;
 if checked_version is distinct from p.schedule_version then raise exception 'El horario ha cambiado. Recarga el calendario antes de responder'; end if;
 if checked_attending is null or length(coalesce(checked_comment,'')) > 500 then raise exception 'Revisa la respuesta y el comentario'; end if;
 if p.status='cancelled' or (p.session_date+p.end_time) at time zone 'Europe/Madrid' <= clock_timestamp()
   or exists(select 1 from public.training_sessions ts where ts.session_date=p.session_date)
   or exists(select 1 from public.season_holidays h where h.season_id=p.season_id and h.holiday_date=p.session_date) then
   raise exception 'La respuesta a este entrenamiento ya está cerrada';
 end if;
 insert into public.training_responses(training_plan_id,player_id,attending,comment,schedule_version)
 values(p.id,auth.uid(),checked_attending,trim(coalesce(checked_comment,'')),p.schedule_version)
 on conflict(training_plan_id,player_id) do update set attending=excluded.attending,comment=excluded.comment,
   schedule_version=excluded.schedule_version,updated_at=clock_timestamp();
end;
$$;
revoke all on function public.save_training_response(uuid,boolean,text,integer) from public,anon;
grant execute on function public.save_training_response(uuid,boolean,text,integer) to authenticated;

-- Solo para el registro deportivo. No concede acceso al plan ni a datos privados.
create function public.get_training_attendance_basis(checked_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.current_user_has_permission('attendance.record') or not exists(select 1 from public.profiles p
   where p.id=auth.uid() and (p.is_owner or p.is_coach) and p.is_approved and p.is_active and not p.is_archived) then
   raise exception 'No tienes permiso para registrar asistencia';
 end if;
 return jsonb_build_object(
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

create or replace function public.set_season_holidays(checked_season_id uuid, checked_dates date[])
returns void language plpgsql security definer set search_path = '' as $$
declare checked_date date;
begin
  if not exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_owner and profile.is_approved and profile.is_active and not profile.is_archived) then
    raise exception 'Solo el owner puede modificar festivos';
  end if;
  perform 1 from public.seasons where id=checked_season_id for update;
  if not found then raise exception 'La temporada no existe'; end if;
  if cardinality(checked_dates) > 370 then raise exception 'Demasiados festivos'; end if;
  foreach checked_date in array coalesce(checked_dates, '{}'::date[]) loop
    if not exists (select 1 from public.seasons season where season.id = checked_season_id and checked_date between season.start_date and season.end_date) then
      raise exception 'El festivo % no pertenece al periodo de la temporada', checked_date;
    end if;
  end loop;
  delete from public.season_holidays where season_id = checked_season_id;
  insert into public.season_holidays (season_id, holiday_date)
  select distinct checked_season_id, selected_dates.holiday_date
  from unnest(coalesce(checked_dates, '{}'::date[])) as selected_dates(holiday_date);
end;
$$;

revoke all on function public.set_season_holidays(uuid,date[]) from public,anon;
grant execute on function public.set_season_holidays(uuid,date[]) to authenticated;

-- Vista previa y escritura comparten la misma selección. La escritura vuelve a comprobar todo.
create function public.generate_training_schedule(apply_changes boolean default false)
returns table(session_date date,title text,result text)
language plpgsql security definer set search_path = '' as $$
declare season public.seasons; day date; existing_title text; saved_id uuid; today date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
begin
 if not public.current_user_has_permission('training.generate') or not exists(select 1 from public.profiles p
   where p.id=auth.uid() and (p.is_owner or p.is_coach) and p.is_approved and p.is_active and not p.is_archived) then
   raise exception 'No tienes permiso para generar entrenamientos';
 end if;
 select * into season from public.seasons s where today between s.start_date and s.end_date for share;
 if not found then raise exception 'No hay temporada activa para generar entrenamientos'; end if;
 -- El bloqueo de temporada coordina generaciones simultáneas y cambios de festivos.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('training-season:'||season.id::text,0));
 for day in select d::date from pg_catalog.generate_series(today::timestamp,season.end_date::timestamp,interval '1 day') d
   where extract(isodow from d) in (2,4,5) loop
   session_date:=day;
   title:='Entrenamiento ' || (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from day)::int]
      || ' ' || extract(day from day)::int || ' ' || (array['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'])[extract(month from day)::int];
   select p.title into existing_title from public.training_plans p where p.session_date=day;
   if found then result:='existing'; title:=existing_title;
   elsif exists(select 1 from public.season_holidays h where h.season_id=season.id and h.holiday_date=day) then result:='holiday';
   elsif (day+time '19:30') at time zone 'Europe/Madrid' <= clock_timestamp() then result:='past';
   elsif exists(select 1 from public.training_sessions ts where ts.session_date=day) then result:='recorded';
   elsif apply_changes then
     insert into public.training_plans(season_id,session_date,title,status,created_by)
       values(season.id,day,title,'draft',auth.uid()) on conflict on constraint training_plans_session_date_key do nothing returning id into saved_id;
     result:=case when saved_id is null then 'existing' else 'created' end;
   else result:='new'; end if;
   return next;
 end loop;
end;
$$;
revoke all on function public.generate_training_schedule(boolean) from public,anon;
grant execute on function public.generate_training_schedule(boolean) to authenticated;

create or replace function public.save_training_plan(
  checked_plan_id uuid,
  checked_season_id uuid,
  checked_session_date date,
  checked_title text,
  checked_objectives text,
  checked_material text,
  checked_status public.task_status,
  checked_exercises jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  saved_plan_id uuid;
begin
  if not public.current_user_can_manage_sport() then
    raise exception 'No tienes permiso para gestionar entrenamientos';
  end if;

  if nullif(trim(checked_title), '') is null then
    raise exception 'Escribe un título para el entrenamiento';
  end if;

  if not exists (
    select 1 from public.seasons s
    where s.id = checked_season_id
      and checked_session_date between s.start_date and s.end_date
  ) then
    raise exception 'La fecha no pertenece a la temporada seleccionada';
  end if;

  if checked_exercises is null or jsonb_typeof(checked_exercises) <> 'array' then
    raise exception 'Revisa los ejercicios';
  end if;
  if checked_status = 'published' and jsonb_array_length(checked_exercises) = 0 then
    raise exception 'Añade al menos un ejercicio';
  end if;

  if exists (
    select 1 from jsonb_array_elements(checked_exercises) exercise
    where nullif(trim(exercise->>'title'), '') is null
      or coalesce((exercise->>'duration_minutes')::integer, 0) not between 1 and 240
  ) then
    raise exception 'Revisa el título y la duración de los ejercicios';
  end if;

  if checked_plan_id is null then
    insert into public.training_plans (
      season_id, session_date, title, objectives, material, status, created_by
    ) values (
      checked_season_id, checked_session_date, trim(checked_title),
      nullif(trim(checked_objectives), ''), nullif(trim(checked_material), ''),
      checked_status, auth.uid()
    ) returning id into saved_plan_id;
  else
    update public.training_plans set
      season_id = checked_season_id,
      session_date = checked_session_date,
      title = trim(checked_title),
      objectives = nullif(trim(checked_objectives), ''),
      material = nullif(trim(checked_material), ''),
      status = checked_status
    where id = checked_plan_id;

    if not found then raise exception 'El entrenamiento no existe'; end if;
    saved_plan_id := checked_plan_id;
    delete from public.training_exercises where training_plan_id = saved_plan_id;
  end if;

  insert into public.training_exercises (
    training_plan_id, sort_order, title, description, duration_minutes, diagram_data
  )
  select
    saved_plan_id,
    exercise_order - 1,
    trim(exercise->>'title'),
    nullif(trim(exercise->>'description'), ''),
    (exercise->>'duration_minutes')::smallint,
    coalesce(exercise->'diagram_data', '{"version":1,"template":"full","elements":[]}'::jsonb)
  from jsonb_array_elements(checked_exercises) with ordinality as items(exercise, exercise_order);

  return saved_plan_id;
end;
$$;

revoke all on function public.save_training_plan(uuid, uuid, date, text, text, text, public.task_status, jsonb) from public,anon;
grant execute on function public.save_training_plan(uuid, uuid, date, text, text, text, public.task_status, jsonb) to authenticated;

commit;
