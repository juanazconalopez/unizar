-- Los usuarios desautorizados conservan su histórico, pero dejan de
-- aparecer en los listados operativos y no pueden utilizar la aplicación.
alter table public.profiles
  add column is_archived boolean not null default false;

-- Cada entrenamiento de campo se representa con una sesión fechada.
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Se guarda una fila por jugadora y sesión, también cuando no asiste.
-- Esto permite calcular porcentajes reales de asistencia.
create table public.training_attendance (
  session_id uuid not null
    references public.training_sessions(id) on delete cascade,
  player_id uuid not null
    references public.profiles(id),
  attended boolean not null default false,
  marked_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (session_id, player_id)
);

create index training_attendance_player_idx
  on public.training_attendance (player_id);

create index training_sessions_date_idx
  on public.training_sessions (session_date desc);

alter table public.training_sessions enable row level security;
alter table public.training_attendance enable row level security;

-- Incorporar is_archived a todas las comprobaciones de acceso existentes.
create or replace function public.current_user_is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_approved = true
      and is_archived = false
  );
$$;

create or replace function public.current_user_is_active_player()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_approved = true
      and is_active = true
      and is_archived = false
  );
$$;

create or replace function public.current_user_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_approved = true
      and is_owner = true
      and is_archived = false
  );
$$;

create or replace function public.current_user_can_manage_tasks()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_approved = true
      and is_archived = false
      and (is_owner = true or is_collaborator = true)
  );
$$;

create or replace function public.player_can_complete_task(
  checked_task_id uuid,
  checked_player_id uuid,
  checked_performed_on date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks as t
    join public.season_players as sp
      on sp.season_id = t.season_id
     and sp.player_id = checked_player_id
    join public.profiles as p
      on p.id = checked_player_id
    where t.id = checked_task_id
      and t.status = 'published'
      and p.is_approved = true
      and p.is_active = true
      and p.is_archived = false
      and t.week_start + 6 >= sp.active_from
      and (sp.active_until is null or t.week_start <= sp.active_until)
      and checked_performed_on between t.week_start and t.week_start + 6
  );
$$;

-- Las jugadoras pueden consultar las fechas en las que tienen asistencia.
create policy "Players can read their training sessions"
on public.training_sessions
for select
to authenticated
using (
  (select public.current_user_is_owner())
  or (
    (select public.current_user_is_approved())
    and exists (
      select 1
      from public.training_attendance
      where training_attendance.session_id = training_sessions.id
        and training_attendance.player_id = (select auth.uid())
    )
  )
);

create policy "Owners can create training sessions"
on public.training_sessions
for insert
to authenticated
with check (
  (select public.current_user_is_owner())
  and created_by = (select auth.uid())
);

create policy "Owners can update training sessions"
on public.training_sessions
for update
to authenticated
using ((select public.current_user_is_owner()))
with check ((select public.current_user_is_owner()));

create policy "Owners can delete training sessions"
on public.training_sessions
for delete
to authenticated
using ((select public.current_user_is_owner()));

-- Cada jugadora solo ve su histórico. El owner ve y gestiona el equipo.
create policy "Players can read their own attendance"
on public.training_attendance
for select
to authenticated
using (
  player_id = (select auth.uid())
  or (select public.current_user_is_owner())
);

create policy "Owners can create attendance"
on public.training_attendance
for insert
to authenticated
with check (
  (select public.current_user_is_owner())
  and marked_by = (select auth.uid())
);

create policy "Owners can update attendance"
on public.training_attendance
for update
to authenticated
using ((select public.current_user_is_owner()))
with check (
  (select public.current_user_is_owner())
  and marked_by = (select auth.uid())
);

create policy "Owners can delete attendance"
on public.training_attendance
for delete
to authenticated
using ((select public.current_user_is_owner()));
