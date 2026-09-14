-- La finalidad de una encuesta orienta las respuestas sin formar parte de
-- ninguna pregunta. Las descripciones existentes se conservan por compatibilidad.
alter table public.surveys
  add constraint surveys_description_length
  check (description is null or length(trim(description)) between 1 and 600) not valid;

create or replace function public.save_survey_draft(
  checked_survey_id uuid,
  checked_season_id uuid,
  checked_title text,
  checked_description text,
  checked_starts_on date,
  checked_ends_on date,
  checked_visibility public.survey_visibility,
  checked_questions jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  saved_survey_id uuid;
  normalized_title text := trim(coalesce(checked_title, ''));
  normalized_description text := nullif(trim(coalesce(checked_description, '')), '');
  question_data jsonb;
  option_data jsonb;
  question_id uuid;
  question_index integer := 0;
  option_index integer;
  prompt text;
  option_label text;
  question_type public.survey_question_type;
begin
  if checked_survey_id is null then
    if not public.current_user_has_permission('surveys.create') then raise exception 'No tienes permiso para crear encuestas'; end if;
  elsif not public.current_user_has_permission('surveys.edit') then
    raise exception 'No tienes permiso para editar encuestas';
  end if;
  if length(normalized_title) not between 3 and 140 then raise exception 'El título debe tener entre 3 y 140 caracteres'; end if;
  if normalized_description is not null and length(normalized_description) > 600 then raise exception 'La descripción no puede superar los 600 caracteres'; end if;
  if checked_starts_on is null or checked_ends_on is null or checked_starts_on > checked_ends_on then raise exception 'Las fechas de la encuesta no son válidas'; end if;
  if checked_visibility = 'private' and not public.current_user_is_owner() then raise exception 'Solo el owner puede crear o editar encuestas privadas'; end if;
  if not exists (
    select 1 from public.seasons
    where id = checked_season_id
      and checked_starts_on between start_date and end_date
      and checked_ends_on between start_date and end_date
  ) then raise exception 'Las fechas deben estar dentro de la temporada'; end if;
  if coalesce(jsonb_typeof(checked_questions), '') <> 'array' or jsonb_array_length(checked_questions) not between 1 and 50 then
    raise exception 'Añade entre una y 50 preguntas';
  end if;

  if checked_survey_id is null then
    insert into public.surveys (season_id, title, description, starts_on, ends_on, visibility, created_by)
    values (checked_season_id, normalized_title, normalized_description, checked_starts_on, checked_ends_on, checked_visibility, (select auth.uid()))
    returning id into saved_survey_id;
  else
    select id into saved_survey_id from public.surveys where id = checked_survey_id and status = 'draft' for update;
    if not found then raise exception 'La encuesta no existe o ya se ha publicado'; end if;
    update public.surveys
    set season_id = checked_season_id, title = normalized_title, description = normalized_description,
      starts_on = checked_starts_on, ends_on = checked_ends_on, visibility = checked_visibility
    where id = saved_survey_id;
    delete from public.survey_questions where survey_id = saved_survey_id;
  end if;

  for question_data in select value from jsonb_array_elements(checked_questions) loop
    prompt := trim(coalesce(question_data->>'prompt', ''));
    if length(prompt) not between 3 and 1000 then raise exception 'Cada pregunta debe tener entre 3 y 1000 caracteres'; end if;
    if coalesce(question_data->>'type', '') not in ('long', 'single', 'multiple') then raise exception 'El tipo de pregunta no es válido'; end if;
    question_type := (question_data->>'type')::public.survey_question_type;
    if question_type <> 'long' and (
      jsonb_typeof(question_data->'options') <> 'array'
      or jsonb_array_length(question_data->'options') not between 1 and 50
    ) then raise exception 'Las preguntas con opciones necesitan entre una y 50 opciones'; end if;

    insert into public.survey_questions (survey_id, prompt, question_type, is_required, sort_order)
    values (saved_survey_id, prompt, question_type, coalesce((question_data->>'required')::boolean, true), question_index)
    returning id into question_id;

    if question_type <> 'long' then
      option_index := 0;
      for option_data in select value from jsonb_array_elements(question_data->'options') loop
        if jsonb_typeof(option_data) <> 'string' then raise exception 'Cada opción debe ser texto'; end if;
        option_label := trim(option_data #>> '{}');
        if length(option_label) not between 1 and 300 then raise exception 'Cada opción debe tener entre 1 y 300 caracteres'; end if;
        insert into public.survey_options (question_id, label, sort_order) values (question_id, option_label, option_index);
        option_index := option_index + 1;
      end loop;
    end if;
    question_index := question_index + 1;
  end loop;

  return saved_survey_id;
end;
$$;

create or replace function public.get_survey_draft(checked_survey_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', survey.id, 'seasonId', survey.season_id, 'title', survey.title,
    'description', survey.description, 'startsOn', survey.starts_on, 'endsOn', survey.ends_on,
    'visibility', survey.visibility,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question.id, 'prompt', question.prompt, 'type', question.question_type,
        'required', question.is_required,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label) order by option.sort_order)
          from public.survey_options option where option.question_id = question.id
        ), '[]'::jsonb)
      ) order by question.sort_order)
      from public.survey_questions question where question.survey_id = survey.id
    ), '[]'::jsonb)
  )
  from public.surveys survey
  where survey.id = checked_survey_id and survey.status = 'draft'
    and public.current_user_has_permission('surveys.edit')
$$;

create or replace function public.get_manage_surveys()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', survey.id, 'title', survey.title, 'description', survey.description,
    'seasonId', survey.season_id, 'visibility', survey.visibility, 'status', survey.status,
    'startsOn', survey.starts_on, 'endsOn', survey.ends_on,
    'responses', (select count(*) from public.survey_responses response where response.survey_id = survey.id),
    'recipients', (select count(*) from public.survey_recipients recipient where recipient.survey_id = survey.id)
  ) order by survey.created_at desc), '[]'::jsonb)
  from public.surveys survey
  where (select public.current_user_has_permission('surveys.view_manage'))
    and (survey.visibility <> 'private' or exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner))
$$;

create or replace function public.get_survey_results(checked_survey_id uuid, checked_player_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare checked_survey public.surveys; is_owner boolean;
begin
  select * into checked_survey from public.surveys where id = checked_survey_id;
  if not found then raise exception 'La encuesta no existe'; end if;
  select profile.is_owner into is_owner from public.profiles profile where profile.id = (select auth.uid());
  if not is_owner and not public.survey_result_is_visible(checked_survey) then raise exception 'No tienes permiso para consultar estos resultados'; end if;
  if checked_player_id is not null and not is_owner then raise exception 'Solo el owner puede consultar respuestas individuales'; end if;
  return jsonb_build_object(
    'survey', jsonb_build_object('id', checked_survey.id, 'title', checked_survey.title, 'description', checked_survey.description, 'visibility', checked_survey.visibility, 'status', checked_survey.status, 'startsOn', checked_survey.starts_on, 'endsOn', checked_survey.ends_on),
    'participation', jsonb_build_object('recipients', (select count(*) from public.survey_recipients where survey_id = checked_survey_id), 'responses', (select count(*) from public.survey_responses where survey_id = checked_survey_id)),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', question.id, 'prompt', question.prompt, 'type', question.question_type,
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label, 'count', (select count(*) from public.survey_answers answer where answer.question_id = question.id and option.id = any(answer.option_ids))) order by option.sort_order) from public.survey_options option where option.question_id = question.id), '[]'::jsonb),
      'longAnswers', case when checked_player_id is not null then coalesce((select jsonb_agg(jsonb_build_object('playerId', response.player_id, 'playerName', player.display_name, 'text', answer.answer_text) order by response.submitted_at) from public.survey_answers answer join public.survey_responses response on response.id = answer.response_id join public.profiles player on player.id = response.player_id where answer.question_id = question.id and response.player_id = checked_player_id and answer.answer_text is not null), '[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('text', answer.answer_text) order by response.submitted_at) from public.survey_answers answer join public.survey_responses response on response.id = answer.response_id where answer.question_id = question.id and answer.answer_text is not null), '[]'::jsonb) end
    ) order by question.sort_order) from public.survey_questions question where question.survey_id = checked_survey_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.save_survey_draft(uuid,uuid,text,text,date,date,public.survey_visibility,jsonb), public.get_survey_draft(uuid) from public;
grant execute on function public.save_survey_draft(uuid,uuid,text,text,date,date,public.survey_visibility,jsonb), public.get_survey_draft(uuid) to authenticated;
