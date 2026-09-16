-- Gestión ve el tramo mientras una encuesta está abierta y la Q en el día
-- posterior a su cierre. Antes de cerrar, esa Q da acceso a resultados provisionales.
create or replace function public.get_visible_survey_closures(checked_from date, checked_until date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', survey.id,
    'title', survey.title,
    'result_date', survey.ends_on + 1,
    'state', case when public.current_survey_date() between survey.starts_on and survey.ends_on then 'active' else 'closed' end,
    'visibility', survey.visibility,
    'startsOn', survey.starts_on,
    'endsOn', survey.ends_on
  ) order by survey.ends_on, survey.title), '[]'::jsonb)
  from public.surveys survey
  where survey.status = 'published'
    and public.survey_result_is_visible(survey)
    and (
      (public.current_survey_date() between survey.starts_on and survey.ends_on
        and (
          (survey.starts_on <= checked_until and survey.ends_on >= checked_from)
          or survey.ends_on + 1 between checked_from and checked_until
        ))
      or (public.current_survey_date() > survey.ends_on and survey.ends_on + 1 between checked_from and checked_until)
    )
$$;

revoke all on function public.get_visible_survey_closures(date,date) from public;
grant execute on function public.get_visible_survey_closures(date,date) to authenticated;
