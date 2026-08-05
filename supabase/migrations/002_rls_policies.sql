-- Funciones auxiliares de permisos.
-- SECURITY DEFINER permite comprobar los permisos sin provocar
-- recursión en las políticas de la tabla profiles.

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
      and (
        is_owner = true
        or is_collaborator = true
      )
  );
$$;

-- Comprueba que un jugador puede completar una tarea
-- y que la fecha seleccionada pertenece a su semana.
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

      -- La semana de la tarea coincide con el periodo
      -- de participación del jugador.
      and t.week_start + 6 >= sp.active_from
      and (
        sp.active_until is null
        or t.week_start <= sp.active_until
      )

      -- La realización debe estar entre lunes y domingo.
      and checked_performed_on between
        t.week_start and t.week_start + 6
  );
$$;

-- Impedir su uso a visitantes sin autenticar.
revoke all on function public.current_user_is_approved() from public;
revoke all on function public.current_user_is_active_player() from public;
revoke all on function public.current_user_is_owner() from public;
revoke all on function public.current_user_can_manage_tasks() from public;
revoke all on function public.player_can_complete_task(uuid, uuid, date)
  from public;

grant execute on function public.current_user_is_approved()
  to authenticated;
grant execute on function public.current_user_is_active_player()
  to authenticated;
grant execute on function public.current_user_is_owner()
  to authenticated;
grant execute on function public.current_user_can_manage_tasks()
  to authenticated;
grant execute on function public.player_can_complete_task(uuid, uuid, date)
  to authenticated;


-- =========================================================
-- PROFILES
-- =========================================================

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
);

create policy "Owners can read every profile"
on public.profiles
for select
to authenticated
using (
  (select public.current_user_is_owner())
);

create policy "Owners can update profiles"
on public.profiles
for update
to authenticated
using (
  (select public.current_user_is_owner())
)
with check (
  (select public.current_user_is_owner())
);


-- =========================================================
-- SEASONS
-- =========================================================

create policy "Players can read their seasons"
on public.seasons
for select
to authenticated
using (
  (
    (select public.current_user_is_active_player())
    and exists (
      select 1
      from public.season_players
      where season_players.season_id = seasons.id
        and season_players.player_id = (select auth.uid())
    )
  )
  or (select public.current_user_can_manage_tasks())
);

create policy "Owners can create seasons"
on public.seasons
for insert
to authenticated
with check (
  (select public.current_user_is_owner())
  and created_by = (select auth.uid())
);

create policy "Owners can update seasons"
on public.seasons
for update
to authenticated
using (
  (select public.current_user_is_owner())
)
with check (
  (select public.current_user_is_owner())
);

create policy "Owners can delete seasons"
on public.seasons
for delete
to authenticated
using (
  (select public.current_user_is_owner())
);


-- =========================================================
-- SEASON PLAYERS
-- =========================================================

create policy "Players can read their season memberships"
on public.season_players
for select
to authenticated
using (
  player_id = (select auth.uid())
  or (select public.current_user_is_owner())
);

create policy "Owners can add season players"
on public.season_players
for insert
to authenticated
with check (
  (select public.current_user_is_owner())
);

create policy "Owners can update season players"
on public.season_players
for update
to authenticated
using (
  (select public.current_user_is_owner())
)
with check (
  (select public.current_user_is_owner())
);

create policy "Owners can remove season players"
on public.season_players
for delete
to authenticated
using (
  (select public.current_user_is_owner())
);


-- =========================================================
-- TASKS
-- =========================================================

create policy "Players can read their published tasks"
on public.tasks
for select
to authenticated
using (
  (
    status = 'published'
    and (select public.current_user_is_active_player())
    and exists (
      select 1
      from public.season_players
      where season_players.season_id = tasks.season_id
        and season_players.player_id = (select auth.uid())
        and tasks.week_start + 6 >= season_players.active_from
        and (
          season_players.active_until is null
          or tasks.week_start <= season_players.active_until
        )
    )
  )
  or (select public.current_user_can_manage_tasks())
);

create policy "Collaborators can create tasks"
on public.tasks
for insert
to authenticated
with check (
  (select public.current_user_can_manage_tasks())
  and created_by = (select auth.uid())
);

create policy "Creators and owners can update tasks"
on public.tasks
for update
to authenticated
using (
  (select public.current_user_is_owner())
  or (
    (select public.current_user_can_manage_tasks())
    and created_by = (select auth.uid())
  )
)
with check (
  (select public.current_user_is_owner())
  or (
    (select public.current_user_can_manage_tasks())
    and created_by = (select auth.uid())
  )
);

create policy "Creators and owners can delete tasks"
on public.tasks
for delete
to authenticated
using (
  (select public.current_user_is_owner())
  or (
    (select public.current_user_can_manage_tasks())
    and created_by = (select auth.uid())
  )
);


-- =========================================================
-- TASK RESULTS
-- =========================================================

create policy "Players can read their own results"
on public.task_results
for select
to authenticated
using (
  player_id = (select auth.uid())
  or (select public.current_user_is_owner())
);

create policy "Players can complete their own tasks"
on public.task_results
for insert
to authenticated
with check (
  player_id = (select auth.uid())
  and public.player_can_complete_task(
    task_id,
    player_id,
    performed_on
  )
);

create policy "Players can update their own results"
on public.task_results
for update
to authenticated
using (
  player_id = (select auth.uid())
  or (select public.current_user_is_owner())
)
with check (
  (
    player_id = (select auth.uid())
    and public.player_can_complete_task(
      task_id,
      player_id,
      performed_on
    )
  )
  or (select public.current_user_is_owner())
);

create policy "Owners can delete results"
on public.task_results
for delete
to authenticated
using (
  (select public.current_user_is_owner())
);