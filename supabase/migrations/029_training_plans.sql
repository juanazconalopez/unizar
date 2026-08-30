-- Planes tácticos de entrenamiento. Se mantienen separados de
-- training_sessions porque estas últimas también alimentan la asistencia y
-- algunas jugadoras pueden consultar sus propias sesiones.
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  session_date date not null unique,
  title text not null,
  objectives text,
  material text,
  status public.task_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint training_plans_title_not_empty check (length(trim(title)) > 0)
);

create table public.training_exercises (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references public.training_plans(id) on delete cascade,
  sort_order integer not null default 0,
  title text not null,
  description text,
  duration_minutes smallint not null default 10,
  diagram_data jsonb not null default '{"version":1,"template":"full","elements":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint training_exercises_title_not_empty check (length(trim(title)) > 0),
  constraint training_exercises_duration_valid check (duration_minutes between 1 and 240),
  constraint training_exercises_diagram_object check (jsonb_typeof(diagram_data) = 'object'),
  constraint training_exercises_order_unique unique (training_plan_id, sort_order)
);

create table public.training_exercise_presets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_minutes smallint not null default 10,
  diagram_data jsonb not null default '{"version":1,"template":"full","elements":[]}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint training_exercise_presets_title_not_empty check (length(trim(title)) > 0),
  constraint training_exercise_presets_duration_valid check (duration_minutes between 1 and 240),
  constraint training_exercise_presets_diagram_object check (jsonb_typeof(diagram_data) = 'object')
);

create index training_plans_season_date_idx on public.training_plans (season_id, session_date desc);
create index training_exercises_plan_order_idx on public.training_exercises (training_plan_id, sort_order);
create index training_exercise_presets_title_idx on public.training_exercise_presets (lower(title));

create trigger training_plans_set_updated_at before update on public.training_plans
for each row execute function public.set_updated_at();
create trigger training_exercises_set_updated_at before update on public.training_exercises
for each row execute function public.set_updated_at();
create trigger training_exercise_presets_set_updated_at before update on public.training_exercise_presets
for each row execute function public.set_updated_at();

alter table public.training_plans enable row level security;
alter table public.training_exercises enable row level security;
alter table public.training_exercise_presets enable row level security;

-- Por ahora solo owner y Entrenador pueden consultar o modificar los planes.
create policy "Sport managers can read training plans" on public.training_plans
for select to authenticated using ((select public.current_user_can_manage_sport()));
create policy "Sport managers can create training plans" on public.training_plans
for insert to authenticated with check (
  (select public.current_user_can_manage_sport()) and created_by = (select auth.uid())
);
create policy "Sport managers can update training plans" on public.training_plans
for update to authenticated using ((select public.current_user_can_manage_sport()))
with check ((select public.current_user_can_manage_sport()));
create policy "Sport managers can delete training plans" on public.training_plans
for delete to authenticated using ((select public.current_user_can_manage_sport()));

create policy "Sport managers can read training exercises" on public.training_exercises
for select to authenticated using ((select public.current_user_can_manage_sport()));
create policy "Sport managers can create training exercises" on public.training_exercises
for insert to authenticated with check ((select public.current_user_can_manage_sport()));
create policy "Sport managers can update training exercises" on public.training_exercises
for update to authenticated using ((select public.current_user_can_manage_sport()))
with check ((select public.current_user_can_manage_sport()));
create policy "Sport managers can delete training exercises" on public.training_exercises
for delete to authenticated using ((select public.current_user_can_manage_sport()));

create policy "Sport managers can read training exercise presets" on public.training_exercise_presets
for select to authenticated using ((select public.current_user_can_manage_sport()));
create policy "Sport managers can create training exercise presets" on public.training_exercise_presets
for insert to authenticated with check (
  (select public.current_user_can_manage_sport()) and created_by = (select auth.uid())
);
create policy "Sport managers can update training exercise presets" on public.training_exercise_presets
for update to authenticated using ((select public.current_user_can_manage_sport()))
with check ((select public.current_user_can_manage_sport()));
create policy "Sport managers can delete training exercise presets" on public.training_exercise_presets
for delete to authenticated using ((select public.current_user_can_manage_sport()));

-- Guarda cabecera y ejercicios en una sola transacción. Los ejercicios se
-- reemplazan porque el editor trabaja con una lista ordenada completa.
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

  if jsonb_typeof(checked_exercises) <> 'array' or jsonb_array_length(checked_exercises) = 0 then
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

revoke all on function public.save_training_plan(uuid, uuid, date, text, text, text, public.task_status, jsonb) from public;
grant execute on function public.save_training_plan(uuid, uuid, date, text, text, text, public.task_status, jsonb) to authenticated;
