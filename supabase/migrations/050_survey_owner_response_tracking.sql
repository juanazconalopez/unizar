-- Owner-only tracking of the recipient list and individual answers.
-- The recipient list is a snapshot made at publication time, so it also identifies
-- players who were invited but have not responded after the survey closes.

create or replace function public.get_survey_results(checked_survey_id uuid, checked_player_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  checked_survey public.surveys;
  is_owner boolean := false;
begin
  select * into checked_survey from public.surveys where id = checked_survey_id;
  if not found then raise exception 'La encuesta no existe'; end if;

  select coalesce(profile.is_owner, false) into is_owner
  from public.profiles profile where profile.id = (select auth.uid());

  if not is_owner and not public.survey_result_is_visible(checked_survey) then
    raise exception 'No tienes permiso para consultar estos resultados';
  end if;
  if checked_player_id is not null and not is_owner then
    raise exception 'Solo el owner puede consultar respuestas individuales';
  end if;
  if checked_player_id is not null and not exists (
    select 1 from public.survey_recipients recipient
    where recipient.survey_id = checked_survey_id and recipient.player_id = checked_player_id
  ) then
    raise exception 'La jugadora no forma parte de esta encuesta';
  end if;

  return jsonb_build_object(
    'survey', jsonb_build_object(
      'id', checked_survey.id, 'title', checked_survey.title, 'description', checked_survey.description,
      'visibility', checked_survey.visibility, 'status', checked_survey.status,
      'startsOn', checked_survey.starts_on, 'endsOn', checked_survey.ends_on
    ),
    'participation', jsonb_build_object(
      'recipients', (select count(*) from public.survey_recipients where survey_id = checked_survey_id),
      'responses', (select count(*) from public.survey_responses where survey_id = checked_survey_id)
    ),
    'recipientStatus', case when is_owner then coalesce((
      select jsonb_agg(jsonb_build_object(
        'playerId', recipient.player_id, 'playerName', player.display_name, 'respondedAt', response.submitted_at
      ) order by response.submitted_at is null, player.display_name)
      from public.survey_recipients recipient
      join public.profiles player on player.id = recipient.player_id
      left join public.survey_responses response on response.survey_id = recipient.survey_id and response.player_id = recipient.player_id
      where recipient.survey_id = checked_survey_id
    ), '[]'::jsonb) else null end,
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', question.id, 'prompt', question.prompt, 'type', question.question_type,
      'options', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', option.id, 'label', option.label,
          'count', (select count(*) from public.survey_answers answer where answer.question_id = question.id and option.id = any(answer.option_ids))
        ) order by option.sort_order)
        from public.survey_options option where option.question_id = question.id
      ), '[]'::jsonb),
      'longAnswers', case when checked_player_id is not null then coalesce((
        select jsonb_agg(jsonb_build_object('text', answer.answer_text) order by response.submitted_at)
        from public.survey_answers answer
        join public.survey_responses response on response.id = answer.response_id
        where answer.question_id = question.id and response.player_id = checked_player_id and answer.answer_text is not null
      ), '[]'::jsonb) else coalesce((
        select jsonb_agg(jsonb_build_object('text', answer.answer_text) order by response.submitted_at)
        from public.survey_answers answer
        join public.survey_responses response on response.id = answer.response_id
        where answer.question_id = question.id and answer.answer_text is not null
      ), '[]'::jsonb) end,
      'selectedAnswer', case when checked_player_id is null then null else (
        select jsonb_build_object('text', answer.answer_text, 'optionIds', to_jsonb(answer.option_ids))
        from public.survey_answers answer
        join public.survey_responses response on response.id = answer.response_id
        where answer.question_id = question.id and response.player_id = checked_player_id
      ) end
    ) order by question.sort_order) from public.survey_questions question where question.survey_id = checked_survey_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_survey_results(uuid,uuid) from public;
grant execute on function public.get_survey_results(uuid,uuid) to authenticated;
