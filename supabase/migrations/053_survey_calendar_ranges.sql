-- Las encuestas abiertas se dibujan como un tramo temporal en el calendario.
-- La Q se reserva para la última respuesta de la jugadora o para el resultado al cerrar.
create or replace function public.get_my_calendar_surveys(checked_from date, checked_until date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', survey.id,
    'title', survey.title,
    'result_date', case
      when public.current_survey_date() between survey.starts_on and survey.ends_on
        then case when response.submitted_at is null then null else (response.submitted_at at time zone 'Europe/Madrid')::date end
      else survey.ends_on + 1
    end,
    'state', case when public.current_survey_date() between survey.starts_on and survey.ends_on then 'active' else 'closed' end,
    'responded', response.id is not null,
    'respondedOn', case when response.submitted_at is null then null else (response.submitted_at at time zone 'Europe/Madrid')::date end,
    'visibility', survey.visibility,
    'startsOn', survey.starts_on,
    'endsOn', survey.ends_on
  ) order by survey.ends_on, survey.title), '[]'::jsonb)
  from public.surveys survey
  join public.survey_recipients recipient on recipient.survey_id = survey.id and recipient.player_id = (select auth.uid())
  left join public.survey_responses response on response.survey_id = survey.id and response.player_id = recipient.player_id
  where survey.status = 'published' and (
    (public.current_survey_date() between survey.starts_on and survey.ends_on
      and survey.starts_on <= checked_until and survey.ends_on >= checked_from)
    or (public.current_survey_date() > survey.ends_on and survey.ends_on + 1 between checked_from and checked_until)
  )
$$;

create or replace function public.get_player_preview_survey_closures(checked_player_id uuid, checked_from date, checked_until date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_preview_player(checked_player_id) then
    raise exception 'No tienes permiso para abrir esta vista previa';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', survey.id,
      'title', survey.title,
      'result_date', case
        when public.current_survey_date() between survey.starts_on and survey.ends_on
          then case when response.submitted_at is null then null else (response.submitted_at at time zone 'Europe/Madrid')::date end
        else survey.ends_on + 1
      end,
      'state', case when public.current_survey_date() between survey.starts_on and survey.ends_on then 'active' else 'closed' end,
      'responded', response.id is not null,
      'respondedOn', case when response.submitted_at is null then null else (response.submitted_at at time zone 'Europe/Madrid')::date end,
      'visibility', survey.visibility,
      'startsOn', survey.starts_on,
      'endsOn', survey.ends_on
    ) order by survey.ends_on, survey.title)
    from public.surveys survey
    join public.survey_recipients recipient on recipient.survey_id = survey.id and recipient.player_id = checked_player_id
    left join public.survey_responses response on response.survey_id = survey.id and response.player_id = recipient.player_id
    where survey.status = 'published' and (
      (public.current_survey_date() between survey.starts_on and survey.ends_on
        and survey.starts_on <= checked_until and survey.ends_on >= checked_from)
      or (public.current_survey_date() > survey.ends_on and survey.ends_on + 1 between checked_from and checked_until)
    )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_my_calendar_surveys(date,date), public.get_player_preview_survey_closures(uuid,date,date) from public;
grant execute on function public.get_my_calendar_surveys(date,date), public.get_player_preview_survey_closures(uuid,date,date) to authenticated;
