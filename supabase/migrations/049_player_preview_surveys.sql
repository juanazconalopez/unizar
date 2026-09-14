create or replace function public.get_player_preview_survey_closures(checked_player_id uuid, checked_from date, checked_until date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_preview_player(checked_player_id) then
    raise exception 'No tienes permiso para abrir esta vista previa';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', survey.id, 'title', survey.title, 'result_date', survey.ends_on + 1) order by survey.ends_on)
    from public.surveys survey
    where survey.status = 'published'
      and survey.visibility = 'team'
      and survey.ends_on + 1 between checked_from and checked_until
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_player_preview_survey_closures(uuid,date,date) from public;
grant execute on function public.get_player_preview_survey_closures(uuid,date,date) to authenticated;
