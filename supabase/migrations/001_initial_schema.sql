-- Estados posibles de una tarea.
create type public.task_status as enum (
  'draft',
  'published',
  'cancelled'
);

-- Perfil público y permisos de cada usuario.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_approved boolean not null default false,
  is_active boolean not null default false,
  is_collaborator boolean not null default false,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Temporadas deportivas.
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint seasons_valid_dates
    check (end_date >= start_date)
);

-- Jugadores vinculados a cada temporada.
create table public.season_players (
  season_id uuid not null
    references public.seasons(id) on delete cascade,
  player_id uuid not null
    references public.profiles(id) on delete cascade,
  active_from date not null,
  active_until date,
  created_at timestamptz not null default now(),

  primary key (season_id, player_id),

  constraint season_players_valid_dates
    check (
      active_until is null
      or active_until >= active_from
    )
);

-- Tareas semanales de entrenamiento.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null
    references public.seasons(id) on delete cascade,
  week_start date not null,
  title text not null,
  description text,
  training_type text,
  status public.task_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_title_not_empty
    check (length(trim(title)) > 0),

  constraint tasks_week_starts_monday
    check (extract(isodow from week_start) = 1)
);

-- Resultado enviado por un jugador.
-- La existencia del registro significa que la tarea está completada.
create table public.task_results (
  task_id uuid not null
    references public.tasks(id) on delete cascade,
  player_id uuid not null
    references public.profiles(id) on delete cascade,
  result_text text not null,
  fatigue_level smallint not null,
  performed_on date not null,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (task_id, player_id),

  constraint task_results_text_not_empty
    check (length(trim(result_text)) > 0),

  constraint task_results_valid_fatigue
    check (fatigue_level between 1 and 5)
);

-- Índices para las consultas que utilizaremos con frecuencia.
create index tasks_season_week_idx
  on public.tasks (season_id, week_start);

create index season_players_player_idx
  on public.season_players (player_id);

create index task_results_player_idx
  on public.task_results (player_id);

create index task_results_performed_on_idx
  on public.task_results (performed_on);

-- Activar explícitamente Row Level Security.
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.season_players enable row level security;
alter table public.tasks enable row level security;
alter table public.task_results enable row level security;

-- Crear automáticamente un perfil cuando alguien se registra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'Jugador'
    )
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();