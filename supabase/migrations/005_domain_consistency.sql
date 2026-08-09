-- Canonical task types, historical season membership periods and reliable
-- updated_at values.

update public.tasks set training_type = case training_type
  when 'Carrera' then 'Físico'
  when 'Fuerza' then 'Gimnasio'
  when 'Técnica' then 'Técnico'
  when 'Movilidad' then 'Recuperación'
  else training_type
end;

alter table public.tasks
  add constraint tasks_valid_training_type
  check (training_type is null or training_type in (
    'Físico', 'Gimnasio', 'Táctico', 'Técnico', 'Recuperación', 'Otro'
  ));

alter table public.season_players
  drop constraint season_players_pkey;

alter table public.season_players
  add column id uuid not null default gen_random_uuid(),
  add primary key (id);

create unique index season_players_one_open_period_idx
  on public.season_players (season_id, player_id)
  where active_until is null;

create index season_players_season_player_idx
  on public.season_players (season_id, player_id, active_from);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger seasons_set_updated_at before update on public.seasons
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger task_results_set_updated_at before update on public.task_results
for each row execute function public.set_updated_at();
create trigger training_sessions_set_updated_at before update on public.training_sessions
for each row execute function public.set_updated_at();
create trigger training_attendance_set_updated_at before update on public.training_attendance
for each row execute function public.set_updated_at();
