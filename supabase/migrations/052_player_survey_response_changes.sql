-- Las jugadoras pueden corregir su respuesta mientras la encuesta esté abierta.
-- Solo se conserva la respuesta vigente; submitted_at refleja la última actualización.
create or replace function public.submit_survey_response(checked_survey_id uuid, submitted_answers jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare saved_response_id uuid; answer jsonb; question public.survey_questions; selected_options uuid[];
begin
  if not public.current_user_has_permission('surveys.respond_own') then raise exception 'No tienes permiso para responder encuestas'; end if;
  if not exists (
    select 1 from public.surveys survey
    join public.survey_recipients recipient on recipient.survey_id = survey.id and recipient.player_id = (select auth.uid())
    where survey.id = checked_survey_id and survey.status = 'published'
      and public.current_survey_date() between survey.starts_on and survey.ends_on
  ) then raise exception 'La encuesta no está disponible para responder'; end if;
  if jsonb_typeof(submitted_answers) <> 'array' then raise exception 'Las respuestas no son válidas'; end if;

  for question in select * from public.survey_questions where survey_id = checked_survey_id order by sort_order loop
    select value into answer from jsonb_array_elements(submitted_answers) where value->>'questionId' = question.id::text limit 1;
    selected_options := coalesce(array(select jsonb_array_elements_text(coalesce(answer->'optionIds', '[]'::jsonb))::uuid), '{}'::uuid[]);
    if question.is_required and ((question.question_type = 'long' and nullif(trim(coalesce(answer->>'text', '')), '') is null) or (question.question_type <> 'long' and cardinality(selected_options) = 0)) then raise exception 'Responde todas las preguntas obligatorias'; end if;
    if question.question_type = 'single' and cardinality(selected_options) > 1 then raise exception 'Esta pregunta solo permite una respuesta'; end if;
    if exists (select 1 from unnest(selected_options) option_id where not exists (select 1 from public.survey_options option where option.id = option_id and option.question_id = question.id)) then raise exception 'Una opción no pertenece a la pregunta'; end if;
  end loop;

  insert into public.survey_responses (survey_id, player_id)
  values (checked_survey_id, (select auth.uid()))
  on conflict (survey_id, player_id) do update set submitted_at = now()
  returning id into saved_response_id;
  delete from public.survey_answers answer_row where answer_row.response_id = saved_response_id;

  for question in select * from public.survey_questions where survey_id = checked_survey_id loop
    select value into answer from jsonb_array_elements(submitted_answers) where value->>'questionId' = question.id::text limit 1;
    selected_options := coalesce(array(select jsonb_array_elements_text(coalesce(answer->'optionIds', '[]'::jsonb))::uuid), '{}'::uuid[]);
    if nullif(trim(coalesce(answer->>'text', '')), '') is not null or cardinality(selected_options) > 0 then
      insert into public.survey_answers (response_id, question_id, answer_text, option_ids)
      values (saved_response_id, question.id, nullif(trim(answer->>'text'), ''), selected_options);
    end if;
  end loop;
end;
$$;

create or replace function public.get_survey_for_response(checked_survey_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', survey.id, 'title', survey.title, 'description', survey.description, 'endsOn', survey.ends_on,
    'responded', response.id is not null,
    'answers', coalesce((select jsonb_agg(jsonb_build_object('questionId', answer.question_id, 'text', answer.answer_text, 'optionIds', to_jsonb(answer.option_ids))) from public.survey_answers answer where answer.response_id = response.id), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', question.id, 'prompt', question.prompt, 'type', question.question_type, 'required', question.is_required, 'options', coalesce((select jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label) order by option.sort_order) from public.survey_options option where option.question_id = question.id), '[]'::jsonb)) order by question.sort_order) from public.survey_questions question where question.survey_id = survey.id), '[]'::jsonb)
  )
  from public.surveys survey
  join public.survey_recipients recipient on recipient.survey_id = survey.id
  left join public.survey_responses response on response.survey_id = survey.id and response.player_id = recipient.player_id
  where survey.id = checked_survey_id and recipient.player_id = (select auth.uid()) and survey.status = 'published'
    and public.current_survey_date() between survey.starts_on and survey.ends_on
$$;

create or replace function public.get_my_calendar_surveys(checked_from date, checked_until date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', survey.id, 'title', survey.title, 'result_date',
      case when public.current_survey_date() between survey.starts_on and survey.ends_on then public.current_survey_date() else survey.ends_on + 1 end,
    'state', case when public.current_survey_date() between survey.starts_on and survey.ends_on then 'active' else 'closed' end,
    'responded', response.id is not null, 'visibility', survey.visibility, 'endsOn', survey.ends_on
  ) order by survey.ends_on, survey.title), '[]'::jsonb)
  from public.surveys survey
  join public.survey_recipients recipient on recipient.survey_id = survey.id and recipient.player_id = (select auth.uid())
  left join public.survey_responses response on response.survey_id = survey.id and response.player_id = recipient.player_id
  where survey.status = 'published' and (
    (public.current_survey_date() between survey.starts_on and survey.ends_on and public.current_survey_date() between checked_from and checked_until)
    or (public.current_survey_date() > survey.ends_on and survey.ends_on + 1 between checked_from and checked_until)
  )
$$;

-- Conserva el nombre de la RPC existente para no romper la pantalla de Inicio,
-- pero también comunica las respuestas ya enviadas para que no vuelva a abrirlas.
create or replace function public.get_my_pending_surveys()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', survey.id, 'title', survey.title, 'description', survey.description,
    'startsOn', survey.starts_on, 'endsOn', survey.ends_on, 'visibility', survey.visibility,
    'responded', response.id is not null
  ) order by survey.ends_on, survey.title), '[]'::jsonb)
  from public.surveys survey
  join public.survey_recipients recipient on recipient.survey_id = survey.id and recipient.player_id = (select auth.uid())
  left join public.survey_responses response on response.survey_id = survey.id and response.player_id = recipient.player_id
  where survey.status = 'published' and public.current_survey_date() between survey.starts_on and survey.ends_on
$$;

create or replace function public.get_my_survey_response(checked_survey_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'survey', jsonb_build_object('id', survey.id, 'title', survey.title, 'description', survey.description, 'visibility', survey.visibility, 'endsOn', survey.ends_on),
    'submittedAt', response.submitted_at,
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', question.id, 'prompt', question.prompt, 'type', question.question_type,
      'selectedAnswer', case when answer.response_id is null then null else jsonb_build_object('text', answer.answer_text, 'optionIds', to_jsonb(answer.option_ids)) end,
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label) order by option.sort_order) from public.survey_options option where option.question_id = question.id), '[]'::jsonb)
    ) order by question.sort_order) from public.survey_questions question left join public.survey_answers answer on answer.question_id = question.id and answer.response_id = response.id where question.survey_id = survey.id), '[]'::jsonb)
  )
  from public.surveys survey
  join public.survey_recipients recipient on recipient.survey_id = survey.id and recipient.player_id = (select auth.uid())
  left join public.survey_responses response on response.survey_id = survey.id and response.player_id = recipient.player_id
  where survey.id = checked_survey_id and survey.status = 'published' and public.current_survey_date() >= survey.starts_on
$$;

create or replace function public.get_player_preview_survey_closures(checked_player_id uuid, checked_from date, checked_until date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_preview_player(checked_player_id) then
    raise exception 'No tienes permiso para abrir esta vista previa';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', survey.id, 'title', survey.title, 'result_date',
        case when public.current_survey_date() between survey.starts_on and survey.ends_on then public.current_survey_date() else survey.ends_on + 1 end,
      'state', case when public.current_survey_date() between survey.starts_on and survey.ends_on then 'active' else 'closed' end,
      'responded', response.id is not null, 'visibility', survey.visibility, 'endsOn', survey.ends_on
    ) order by survey.ends_on, survey.title)
    from public.surveys survey
    join public.survey_recipients recipient on recipient.survey_id = survey.id and recipient.player_id = checked_player_id
    left join public.survey_responses response on response.survey_id = survey.id and response.player_id = recipient.player_id
    where survey.status = 'published' and (
      (public.current_survey_date() between survey.starts_on and survey.ends_on and public.current_survey_date() between checked_from and checked_until)
      or (public.current_survey_date() > survey.ends_on and survey.ends_on + 1 between checked_from and checked_until)
    )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_my_calendar_surveys(date,date), public.get_my_survey_response(uuid) from public;
grant execute on function public.get_my_calendar_surveys(date,date), public.get_my_survey_response(uuid) to authenticated;
