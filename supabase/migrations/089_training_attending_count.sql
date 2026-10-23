-- Ejecutar completa después de 088 en el editor SQL de Supabase.
-- Solo se añade el total previsto de respuestas «Asistiré», sin identidades
-- ni comentarios ajenos. La asistencia real y sus estadísticas son independientes.
begin;

-- PostgreSQL exige recrear la función cuando se amplía su resultado TABLE.
-- No tiene dependencias SQL; se conservan la firma de entrada y los permisos.
drop function public.get_training_calendar(date,date);

create function public.get_training_calendar(from_date date,until_date date)
returns table(id uuid,session_date date,title text,status public.task_status,start_time time,end_time time,
 schedule_version integer,own_attending boolean,own_comment text,response_stale boolean,responses_closed boolean,attendance_recorded boolean,attending_count integer)
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
       and public.training_player_eligible(p.season_id,p.session_date,confirmed.player_id)) end
 from public.training_plans p left join public.training_responses r on r.training_plan_id=p.id and r.player_id=auth.uid()
 where p.session_date between from_date and until_date
   and (public.current_user_has_permission('training.view') or public.training_player_eligible(p.season_id,p.session_date,auth.uid()))
 order by p.session_date,p.id;
end;
$$;
revoke all on function public.get_training_calendar(date,date) from public,anon;
grant execute on function public.get_training_calendar(date,date) to authenticated;

notify pgrst,'reload schema';
commit;
