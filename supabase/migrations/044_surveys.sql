-- Encuestas de temporada: las destinatarias se fijan al publicar para que la
-- participación no cambie si se modifican posteriormente las vinculaciones.
create type public.survey_visibility as enum ('team', 'management', 'private');
create type public.survey_question_type as enum ('long', 'single', 'multiple');
create type public.survey_status as enum ('draft', 'published', 'cancelled');

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 140),
  description text,
  starts_on date not null,
  ends_on date not null,
  visibility public.survey_visibility not null default 'private',
  status public.survey_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on),
  check (
    (status = 'draft' and published_by is null and published_at is null)
    or (status in ('published', 'cancelled') and published_by is not null and published_at is not null)
  )
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  prompt text not null check (length(trim(prompt)) between 3 and 1000),
  question_type public.survey_question_type not null,
  is_required boolean not null default true,
  sort_order integer not null check (sort_order >= 0),
  unique (survey_id, sort_order)
);

create table public.survey_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 300),
  sort_order integer not null check (sort_order >= 0),
  unique (question_id, sort_order)
);

create table public.survey_recipients (
  survey_id uuid not null references public.surveys(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  primary key (survey_id, player_id)
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  unique (survey_id, player_id)
);

create table public.survey_answers (
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  answer_text text,
  option_ids uuid[] not null default '{}'::uuid[],
  primary key (response_id, question_id),
  check (cardinality(option_ids) is null or cardinality(option_ids) <= 50),
  check (answer_text is null or length(trim(answer_text)) between 1 and 4000)
);

create index surveys_season_dates_idx on public.surveys (season_id, starts_on, ends_on);
create index survey_responses_survey_idx on public.survey_responses (survey_id);

create trigger surveys_set_updated_at before update on public.surveys for each row execute function public.set_updated_at();

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_options enable row level security;
alter table public.survey_recipients enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;

create or replace function public.guard_survey_immutability()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility = 'private' and not exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner) then
    raise exception 'Solo el owner puede crear o editar encuestas privadas';
  end if;
  if old.status <> 'draft' and (new.title, new.description, new.starts_on, new.ends_on, new.visibility, new.season_id)
    is distinct from (old.title, old.description, old.starts_on, old.ends_on, old.visibility, old.season_id) then
    raise exception 'Una encuesta publicada no se puede editar';
  end if;
  return new;
end;
$$;
create trigger surveys_guard_immutability before update on public.surveys for each row execute function public.guard_survey_immutability();

insert into public.permission_definitions (key, section_key, section_label, label, description, action, parent_key, sort_order, configurable, owner_only)
values
  ('surveys.view_own','surveys','Encuestas','Ver encuestas propias','','view',null,1250,true,false),
  ('surveys.respond_own','surveys','Encuestas','Responder encuestas propias','','edit','surveys.view_own',1260,true,false),
  ('surveys.view_manage','surveys','Encuestas','Acceder a Gestión de encuestas','','view',null,1270,true,false),
  ('surveys.create','surveys','Encuestas','Crear borradores','','create','surveys.view_manage',1280,true,false),
  ('surveys.edit','surveys','Encuestas','Editar borradores','','edit','surveys.view_manage',1290,true,false),
  ('surveys.publish','surveys','Encuestas','Publicar encuestas','','publish','surveys.edit',1300,true,false),
  ('surveys.cancel_own','surveys','Encuestas','Cancelar encuestas publicadas por mí','','edit','surveys.view_manage',1310,true,false),
  ('surveys.results_manage','surveys','Encuestas','Ver resultados de gestión','','view','surveys.view_manage',1320,true,false),
  ('surveys.export','surveys','Encuestas','Exportar resultados','','export','surveys.results_manage',1330,true,false)
on conflict (key) do nothing;

insert into public.role_permission_defaults (role, permission_key)
select role, permission_key from (
  select role, permission_key
  from unnest(array['coach','viewer']::text[]) role
  cross join unnest(array['surveys.view_manage','surveys.create','surveys.edit','surveys.publish','surveys.cancel_own','surveys.results_manage','surveys.export']::text[]) permission_key
  union all select 'player', unnest(array['surveys.view_own','surveys.respond_own'])
) grants
on conflict do nothing;
insert into public.role_permissions (role, permission_key)
select role, permission_key from public.role_permission_defaults where permission_key like 'surveys.%'
on conflict do nothing;

create or replace function public.current_survey_date()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Madrid')::date
$$;

create or replace function public.survey_result_is_visible(checked_survey public.surveys)
returns boolean language sql stable security definer set search_path = '' as $$
  select case checked_survey.visibility
    when 'team' then public.current_user_has_permission('surveys.view_own') or public.current_user_has_permission('surveys.view_manage')
    when 'management' then public.current_user_has_permission('surveys.results_manage')
    when 'private' then exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner)
  end
$$;

create or replace function public.publish_survey(checked_survey_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare checked_survey public.surveys;
begin
  if not public.current_user_has_permission('surveys.publish') then raise exception 'No tienes permiso para publicar encuestas'; end if;
  select * into checked_survey from public.surveys where id = checked_survey_id for update;
  if not found or checked_survey.status <> 'draft' then raise exception 'La encuesta no es un borrador publicable'; end if;
  if checked_survey.visibility = 'private' and not exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner) then
    raise exception 'Solo el owner puede publicar encuestas privadas';
  end if;
  if not exists (select 1 from public.survey_questions where survey_id = checked_survey_id) then raise exception 'Añade al menos una pregunta'; end if;
  if exists (
    select 1 from public.survey_questions question
    where question.survey_id = checked_survey_id and question.question_type <> 'long'
      and not exists (select 1 from public.survey_options option where option.question_id = question.id)
  ) then raise exception 'Las preguntas de opciones necesitan al menos una respuesta'; end if;
  if not exists (select 1 from public.seasons where id = checked_survey.season_id and checked_survey.starts_on between start_date and end_date and checked_survey.ends_on between start_date and end_date) then raise exception 'Las fechas deben estar dentro de la temporada'; end if;
  insert into public.survey_recipients (survey_id, player_id)
  select checked_survey_id, membership.player_id from public.season_players membership join public.profiles player on player.id = membership.player_id
  where membership.season_id = checked_survey.season_id and membership.active_from <= checked_survey.starts_on
    and (membership.active_until is null or membership.active_until >= checked_survey.starts_on)
    and player.is_player and player.is_approved and player.is_active and not player.is_archived;
  update public.surveys set status = 'published', published_by = (select auth.uid()), published_at = now() where id = checked_survey_id;
end;
$$;

create or replace function public.submit_survey_response(checked_survey_id uuid, submitted_answers jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare response_id uuid; answer jsonb; question public.survey_questions; selected_options uuid[];
begin
  if not public.current_user_has_permission('surveys.respond_own') then raise exception 'No tienes permiso para responder encuestas'; end if;
  if not exists (select 1 from public.surveys survey join public.survey_recipients recipient on recipient.survey_id = survey.id and recipient.player_id = (select auth.uid()) where survey.id = checked_survey_id and survey.status = 'published' and public.current_survey_date() between survey.starts_on and survey.ends_on) then raise exception 'La encuesta no está disponible para responder'; end if;
  if jsonb_typeof(submitted_answers) <> 'array' then raise exception 'Las respuestas no son válidas'; end if;
  if exists (select 1 from public.survey_responses where survey_id = checked_survey_id and player_id = (select auth.uid())) then raise exception 'La encuesta ya fue enviada'; end if;
  for question in select * from public.survey_questions where survey_id = checked_survey_id order by sort_order loop
    select value into answer from jsonb_array_elements(submitted_answers) where value->>'questionId' = question.id::text limit 1;
    selected_options := coalesce(array(select jsonb_array_elements_text(coalesce(answer->'optionIds', '[]'::jsonb))::uuid), '{}'::uuid[]);
    if question.is_required and ((question.question_type = 'long' and nullif(trim(coalesce(answer->>'text', '')), '') is null) or (question.question_type <> 'long' and cardinality(selected_options) = 0)) then raise exception 'Responde todas las preguntas obligatorias'; end if;
    if question.question_type = 'single' and cardinality(selected_options) > 1 then raise exception 'Esta pregunta solo permite una respuesta'; end if;
    if exists (select 1 from unnest(selected_options) option_id where not exists (select 1 from public.survey_options option where option.id = option_id and option.question_id = question.id)) then raise exception 'Una opción no pertenece a la pregunta'; end if;
  end loop;
  insert into public.survey_responses (survey_id, player_id) values (checked_survey_id, (select auth.uid())) returning id into response_id;
  for question in select * from public.survey_questions where survey_id = checked_survey_id loop
    select value into answer from jsonb_array_elements(submitted_answers) where value->>'questionId' = question.id::text limit 1;
    selected_options := coalesce(array(select jsonb_array_elements_text(coalesce(answer->'optionIds', '[]'::jsonb))::uuid), '{}'::uuid[]);
    if nullif(trim(coalesce(answer->>'text', '')), '') is not null or cardinality(selected_options) > 0 then
      insert into public.survey_answers (response_id, question_id, answer_text, option_ids) values (response_id, question.id, nullif(trim(answer->>'text'), ''), selected_options);
    end if;
  end loop;
end;
$$;

create or replace function public.cancel_survey(checked_survey_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.surveys survey
    where survey.id = checked_survey_id and survey.status = 'published'
      and (
        exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner)
        or (survey.published_by = (select auth.uid()) and public.current_user_has_permission('surveys.cancel_own'))
      )
  ) then raise exception 'No tienes permiso para cancelar esta encuesta'; end if;
  update public.surveys set status = 'cancelled', cancelled_by = (select auth.uid()), cancelled_at = now() where id = checked_survey_id;
end;
$$;

create policy "Survey managers can read surveys" on public.surveys for select to authenticated using (
  (select public.current_user_has_permission('surveys.view_manage'))
  and (visibility <> 'private' or exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner))
);
create policy "Recipients can read their published surveys" on public.surveys for select to authenticated using (
  status = 'published' and exists (select 1 from public.survey_recipients recipient where recipient.survey_id = id and recipient.player_id = (select auth.uid()))
);
create policy "Survey managers can create drafts" on public.surveys for insert to authenticated with check (
  (select public.current_user_has_permission('surveys.create')) and status = 'draft' and created_by = (select auth.uid())
  and (visibility <> 'private' or exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner))
);
create policy "Survey managers can edit drafts" on public.surveys for update to authenticated using (
  (select public.current_user_has_permission('surveys.edit')) and status = 'draft'
  and (visibility <> 'private' or exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner))
) with check (
  (select public.current_user_has_permission('surveys.edit'))
  and (visibility <> 'private' or exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner))
);
create policy "Visible survey questions" on public.survey_questions for select to authenticated using (exists (select 1 from public.surveys survey where survey.id = survey_id));
create policy "Draft survey questions are editable" on public.survey_questions for all to authenticated using (exists (select 1 from public.surveys survey where survey.id = survey_id and survey.status = 'draft' and (select public.current_user_has_permission('surveys.edit')))) with check (exists (select 1 from public.surveys survey where survey.id = survey_id and survey.status = 'draft' and (select public.current_user_has_permission('surveys.edit'))));
create policy "Visible survey options" on public.survey_options for select to authenticated using (exists (select 1 from public.survey_questions question join public.surveys survey on survey.id = question.survey_id where question.id = question_id));
create policy "Draft survey options are editable" on public.survey_options for all to authenticated using (exists (select 1 from public.survey_questions question join public.surveys survey on survey.id = question.survey_id where question.id = question_id and survey.status = 'draft' and (select public.current_user_has_permission('surveys.edit')))) with check (exists (select 1 from public.survey_questions question join public.surveys survey on survey.id = question.survey_id where question.id = question_id and survey.status = 'draft' and (select public.current_user_has_permission('surveys.edit'))));
create policy "Owners can read individual survey responses" on public.survey_responses for select to authenticated using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner));
create policy "Owners can read individual survey answers" on public.survey_answers for select to authenticated using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner));

create or replace function public.get_survey_results(checked_survey_id uuid, checked_player_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare checked_survey public.surveys; is_owner boolean;
begin
  select * into checked_survey from public.surveys where id = checked_survey_id;
  if not found then raise exception 'La encuesta no existe'; end if;
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner) into is_owner;
  if not is_owner and not public.survey_result_is_visible(checked_survey) then raise exception 'No tienes permiso para consultar estos resultados'; end if;
  if checked_player_id is not null and not is_owner then raise exception 'Solo el owner puede filtrar por jugadora'; end if;
  return jsonb_build_object(
    'survey', jsonb_build_object('id', checked_survey.id, 'title', checked_survey.title, 'visibility', checked_survey.visibility, 'status', checked_survey.status, 'startsOn', checked_survey.starts_on, 'endsOn', checked_survey.ends_on),
    'participation', jsonb_build_object('recipients', (select count(*) from public.survey_recipients where survey_id = checked_survey_id), 'responses', (select count(*) from public.survey_responses where survey_id = checked_survey_id)),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', question.id, 'prompt', question.prompt, 'type', question.question_type, 'required', question.is_required,
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label, 'count', (select count(*) from public.survey_answers answer where answer.question_id = question.id and option.id = any(answer.option_ids))) order by option.sort_order) from public.survey_options option where option.question_id = question.id), '[]'::jsonb),
      'longAnswers', case when checked_player_id is not null then coalesce((select jsonb_agg(jsonb_build_object('playerId', response.player_id, 'playerName', player.display_name, 'text', answer.answer_text) order by response.submitted_at) from public.survey_answers answer join public.survey_responses response on response.id = answer.response_id join public.profiles player on player.id = response.player_id where answer.question_id = question.id and response.player_id = checked_player_id and answer.answer_text is not null), '[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('text', answer.answer_text) order by response.submitted_at) from public.survey_answers answer join public.survey_responses response on response.id = answer.response_id where answer.question_id = question.id and answer.answer_text is not null), '[]'::jsonb) end
    ) order by question.sort_order) from public.survey_questions question where question.survey_id = checked_survey_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_my_pending_surveys()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', survey.id, 'title', survey.title, 'description', survey.description, 'startsOn', survey.starts_on, 'endsOn', survey.ends_on, 'visibility', survey.visibility) order by survey.ends_on), '[]'::jsonb)
  from public.surveys survey join public.survey_recipients recipient on recipient.survey_id = survey.id
  where recipient.player_id = (select auth.uid()) and survey.status = 'published'
    and public.current_survey_date() between survey.starts_on and survey.ends_on
    and not exists (select 1 from public.survey_responses response where response.survey_id = survey.id and response.player_id = recipient.player_id)
$$;

create or replace function public.get_survey_for_response(checked_survey_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', survey.id, 'title', survey.title, 'description', survey.description, 'endsOn', survey.ends_on,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', question.id, 'prompt', question.prompt, 'type', question.question_type, 'required', question.is_required, 'options', coalesce((select jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label) order by option.sort_order) from public.survey_options option where option.question_id = question.id), '[]'::jsonb)) order by question.sort_order) from public.survey_questions question where question.survey_id = survey.id), '[]'::jsonb)
  )
  from public.surveys survey join public.survey_recipients recipient on recipient.survey_id = survey.id
  where survey.id = checked_survey_id and recipient.player_id = (select auth.uid()) and survey.status = 'published'
    and public.current_survey_date() between survey.starts_on and survey.ends_on
    and not exists (select 1 from public.survey_responses response where response.survey_id = survey.id and response.player_id = recipient.player_id)
$$;

create or replace function public.get_visible_survey_closures(checked_from date, checked_until date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', survey.id, 'title', survey.title, 'result_date', survey.ends_on + 1) order by survey.ends_on), '[]'::jsonb)
  from public.surveys survey
  where survey.status = 'published' and survey.ends_on + 1 between checked_from and checked_until
    and public.survey_result_is_visible(survey)
$$;

create or replace function public.get_manage_surveys()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', survey.id, 'title', survey.title, 'visibility', survey.visibility, 'status', survey.status, 'startsOn', survey.starts_on, 'endsOn', survey.ends_on, 'responses', (select count(*) from public.survey_responses response where response.survey_id = survey.id), 'recipients', (select count(*) from public.survey_recipients recipient where recipient.survey_id = survey.id)) order by survey.created_at desc), '[]'::jsonb)
  from public.surveys survey
  where (select public.current_user_has_permission('surveys.view_manage'))
    and (survey.visibility <> 'private' or exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner))
$$;

revoke all on function public.publish_survey(uuid), public.submit_survey_response(uuid,jsonb), public.cancel_survey(uuid), public.get_survey_results(uuid,uuid), public.get_my_pending_surveys(), public.get_survey_for_response(uuid), public.get_visible_survey_closures(date,date), public.get_manage_surveys(), public.survey_result_is_visible(public.surveys), public.guard_survey_immutability() from public;
grant execute on function public.publish_survey(uuid), public.submit_survey_response(uuid,jsonb), public.cancel_survey(uuid), public.get_survey_results(uuid,uuid), public.get_my_pending_surveys(), public.get_survey_for_response(uuid), public.get_visible_survey_closures(date,date), public.get_manage_surveys() to authenticated;
