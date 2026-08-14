-- Permisos acumulables del club. is_player decide si la persona participa en
-- temporadas y estadísticas; owner, coach y viewer añaden capacidades.
alter table public.profiles rename column is_collaborator to is_coach;
alter table public.profiles add column is_viewer boolean not null default false;
alter table public.profiles add column is_player boolean not null default true;
update public.profiles set is_player = false where is_owner;

create or replace function public.current_user_can_manage_sport()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_approved and not is_archived
      and (is_owner or is_coach)
  );
$$;

create or replace function public.current_user_can_view_team_data()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_approved and not is_archived
      and (is_owner or is_coach or is_viewer)
  );
$$;

-- Compatibilidad con los agregados y políticas de lectura anteriores.
-- Las escrituras nuevas usan exclusivamente current_user_can_manage_sport().
create or replace function public.current_user_can_manage_tasks()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_can_view_team_data();
$$;

create or replace function public.current_user_is_active_player()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_approved and is_active and not is_archived
      and is_player
  );
$$;

create or replace function public.player_can_complete_task(
  checked_task_id uuid,
  checked_player_id uuid,
  checked_performed_on date
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tasks t
    join public.season_players sp on sp.season_id = t.season_id and sp.player_id = checked_player_id
    join public.profiles p on p.id = checked_player_id
    where t.id = checked_task_id and t.status = 'published'
      and p.is_approved and p.is_active and not p.is_archived
      and p.is_player
      and t.week_start + 6 >= sp.active_from
      and (sp.active_until is null or t.week_start <= sp.active_until)
      and checked_performed_on between t.week_start and t.week_start + 6
  );
$$;

create or replace function public.player_can_access_match(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.matches m
    join public.season_players sp on sp.season_id = m.season_id and sp.player_id = checked_player_id
    join public.profiles p on p.id = checked_player_id
    where m.id = checked_match_id and m.status <> 'draft'
      and p.is_approved and p.is_active and not p.is_archived
      and p.is_player
      and sp.active_from <= m.match_date
      and (sp.active_until is null or sp.active_until >= m.match_date)
  );
$$;

create or replace function public.current_user_can_edit_match(checked_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_can_manage_sport()
    and exists (select 1 from public.matches where id = checked_match_id);
$$;

revoke all on function public.current_user_can_manage_sport() from public;
revoke all on function public.current_user_can_view_team_data() from public;
grant execute on function public.current_user_can_manage_sport() to authenticated;
grant execute on function public.current_user_can_view_team_data() to authenticated;

-- Solo las cuentas sin permiso Jugadora quedan fuera de las temporadas.
delete from public.season_players sp
using public.profiles p
where p.id = sp.player_id and not p.is_player;

create or replace function public.guard_season_membership_player_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.player_id and p.is_approved and not p.is_archived and p.is_player
  ) then
    raise exception 'Solo una jugadora puede pertenecer a una temporada';
  end if;
  return new;
end;
$$;

create trigger season_players_guard_player_role
before insert or update of player_id on public.season_players
for each row execute function public.guard_season_membership_player_role();

create or replace function public.remove_non_player_season_memberships()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.is_player then
    delete from public.season_players where player_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_remove_non_player_season_memberships
after insert or update of is_player on public.profiles
for each row execute function public.remove_non_player_season_memberships();

-- Temporadas y participantes: el staff consulta; solo owner configura.
create policy "Team staff can read seasons" on public.seasons
for select to authenticated using ((select public.current_user_can_view_team_data()));
create policy "Team staff can read season players" on public.season_players
for select to authenticated using ((select public.current_user_can_view_team_data()));

-- Tareas: Entrenador gestiona todo el trabajo deportivo; Dirección solo lee
-- mediante las políticas de managers ya existentes.
drop policy if exists "Collaborators can create tasks" on public.tasks;
drop policy if exists "Creators and owners can update tasks" on public.tasks;
drop policy if exists "Creators and owners can delete tasks" on public.tasks;
create policy "Sport managers can create tasks" on public.tasks for insert to authenticated
with check ((select public.current_user_can_manage_sport()) and created_by = (select auth.uid()));
create policy "Sport managers can update tasks" on public.tasks for update to authenticated
using ((select public.current_user_can_manage_sport())) with check ((select public.current_user_can_manage_sport()));
create policy "Sport managers can delete tasks" on public.tasks for delete to authenticated
using ((select public.current_user_can_manage_sport()));

-- Partidos: Dirección ve solo datos publicados; Entrenador y owner gestionan.
drop policy if exists "Owners and players can read matches" on public.matches;
drop policy if exists "Owners can create matches" on public.matches;
drop policy if exists "Owners can update matches" on public.matches;
drop policy if exists "Owners can delete matches" on public.matches;
create policy "Staff and players can read matches" on public.matches for select to authenticated using (
  ((select public.current_user_can_manage_sport()))
  or ((select public.current_user_can_view_team_data()) and status <> 'draft')
  or public.player_can_access_match(id, (select auth.uid()))
);
create policy "Sport managers can create matches" on public.matches for insert to authenticated
with check ((select public.current_user_can_manage_sport()) and created_by = (select auth.uid()));
create policy "Sport managers can update matches" on public.matches for update to authenticated
using ((select public.current_user_can_manage_sport())) with check ((select public.current_user_can_manage_sport()));
create policy "Sport managers can delete matches" on public.matches for delete to authenticated
using ((select public.current_user_can_manage_sport()));

drop policy if exists "Players and owners can read availability" on public.match_availability;
create policy "Players and staff can read availability" on public.match_availability for select to authenticated using (
  player_id = (select auth.uid()) or (select public.current_user_can_view_team_data())
);

drop policy if exists "Owners and selected players can read lineups" on public.match_lineup;
create policy "Staff and selected players can read lineups" on public.match_lineup for select to authenticated using (
  (select public.current_user_can_manage_sport())
  or (
    (select public.current_user_can_view_team_data())
    and exists (select 1 from public.matches m where m.id = match_id and m.lineup_published)
  )
  or (
    public.player_can_access_match(match_id, (select auth.uid()))
    and exists (select 1 from public.matches m where m.id = match_id and m.lineup_published)
  )
);

-- La elegibilidad de una convocatoria depende de is_player, aunque la persona
-- tenga además permisos de owner, Entrenador o Dirección.
create or replace function public.save_match_lineup(
  checked_match_id uuid,
  lineup_entries jsonb,
  publish_lineup boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  maximum_slots integer;
  starter_slots integer;
  was_published boolean;
begin
  if not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permiso para gestionar esta alineación';
  end if;

  select
    case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end,
    lineup_published
  into maximum_slots, starter_slots, was_published
  from public.matches
  where id = checked_match_id
  for update;

  if was_published then
    raise exception 'La convocatoria publicada ya no se puede modificar';
  end if;

  if exists (
    select 1 from jsonb_array_elements(lineup_entries) as entries(entry)
    where (entry->>'slot_number')::smallint not between 1 and maximum_slots
  ) then
    raise exception 'El dorsal no es válido para este tipo de partido';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(lineup_entries) as entries(entry)
    left join public.matches m on m.id = checked_match_id
    left join public.season_players sp
      on sp.season_id = m.season_id
      and sp.player_id = (entry->>'player_id')::uuid
      and sp.active_from <= m.match_date
      and (sp.active_until is null or sp.active_until >= m.match_date)
    left join public.profiles p on p.id = (entry->>'player_id')::uuid
    left join public.match_availability ma
      on ma.match_id = checked_match_id
      and ma.player_id = (entry->>'player_id')::uuid
      and ma.status = 'available'::public.availability_status
    where sp.id is null or p.id is null or ma.player_id is null
      or not p.is_approved or not p.is_active or p.is_archived or not p.is_player
  ) then
    raise exception 'La convocatoria contiene una jugadora que ya no está disponible';
  end if;

  delete from public.match_lineup where match_id = checked_match_id;

  insert into public.match_lineup (match_id, player_id, role, position, slot_number, sort_order)
  select
    checked_match_id,
    (entry->>'player_id')::uuid,
    case when (entry->>'slot_number')::smallint <= starter_slots then 'starter'::public.lineup_role else 'substitute'::public.lineup_role end,
    null,
    (entry->>'slot_number')::smallint,
    (entry->>'slot_number')::smallint
  from jsonb_array_elements(lineup_entries) as entries(entry);

  update public.matches set lineup_published = publish_lineup where id = checked_match_id;
end;
$$;

-- Entrenamientos y asistencia: staff en lectura; owner y Entrenador escriben.
create policy "Team staff can read training sessions" on public.training_sessions
for select to authenticated using ((select public.current_user_can_view_team_data()));
drop policy if exists "Owners can create training sessions" on public.training_sessions;
drop policy if exists "Owners can update training sessions" on public.training_sessions;
drop policy if exists "Owners can delete training sessions" on public.training_sessions;
create policy "Sport managers can create training sessions" on public.training_sessions for insert to authenticated
with check ((select public.current_user_can_manage_sport()) and created_by = (select auth.uid()));
create policy "Sport managers can update training sessions" on public.training_sessions for update to authenticated
using ((select public.current_user_can_manage_sport())) with check ((select public.current_user_can_manage_sport()));
create policy "Sport managers can delete training sessions" on public.training_sessions for delete to authenticated
using ((select public.current_user_can_manage_sport()));

drop policy if exists "Players can read their own attendance" on public.training_attendance;
drop policy if exists "Owners can create attendance" on public.training_attendance;
drop policy if exists "Owners can update attendance" on public.training_attendance;
drop policy if exists "Owners can delete attendance" on public.training_attendance;
create policy "Players and staff can read attendance" on public.training_attendance for select to authenticated using (
  player_id = (select auth.uid()) or (select public.current_user_can_view_team_data())
);
create policy "Sport managers can create attendance" on public.training_attendance for insert to authenticated
with check ((select public.current_user_can_manage_sport()) and marked_by = (select auth.uid()));
create policy "Sport managers can update attendance" on public.training_attendance for update to authenticated
using ((select public.current_user_can_manage_sport()))
with check ((select public.current_user_can_manage_sport()) and marked_by = (select auth.uid()));
create policy "Sport managers can delete attendance" on public.training_attendance for delete to authenticated
using ((select public.current_user_can_manage_sport()));

create or replace function public.save_training_attendance(
  attendance_date date,
  checked_player_ids uuid[],
  attended_player_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  checked_session_id uuid;
  checked_season_id uuid;
begin
  if not public.current_user_can_manage_sport() then
    raise exception 'No tienes permiso para guardar asistencia';
  end if;

  select s.id into checked_season_id from public.seasons s
  where attendance_date between s.start_date and s.end_date;
  if checked_season_id is null then
    raise exception 'No hay una temporada que incluya la fecha del entrenamiento';
  end if;

  if exists (
    select 1
    from unnest(checked_player_ids) as selected_player(player_id)
    left join public.profiles p on p.id = selected_player.player_id
    left join public.season_players sp
      on sp.season_id = checked_season_id and sp.player_id = selected_player.player_id
      and sp.active_from <= attendance_date
      and (sp.active_until is null or sp.active_until >= attendance_date)
    where p.id is null or sp.id is null or not p.is_player
  ) then
    raise exception 'La asistencia contiene una jugadora no elegible para esa fecha';
  end if;

  if exists (
    select 1 from unnest(attended_player_ids) as attended_player(player_id)
    where not (attended_player.player_id = any(checked_player_ids))
  ) then
    raise exception 'Una asistente no forma parte del listado del entrenamiento';
  end if;

  insert into public.training_sessions (session_date, season_id, created_by)
  values (attendance_date, checked_season_id, auth.uid())
  on conflict (session_date) do update set season_id = excluded.season_id, updated_at = now()
  returning training_sessions.id into checked_session_id;

  delete from public.training_attendance ta
  where ta.session_id = checked_session_id and not (ta.player_id = any(checked_player_ids));

  insert into public.training_attendance (session_id, player_id, attended, marked_by)
  select checked_session_id, selected_player.player_id,
    selected_player.player_id = any(attended_player_ids), auth.uid()
  from unnest(checked_player_ids) as selected_player(player_id)
  on conflict on constraint training_attendance_pkey do update
    set attended = excluded.attended, marked_by = auth.uid(), updated_at = now();
end;
$$;

-- Avisos: Dirección no accede a Tareas; Entrenador y owner los gestionan.
drop policy if exists "Players can read published team announcements" on public.team_announcements;
drop policy if exists "Collaborators can create team announcements" on public.team_announcements;
drop policy if exists "Creators and owners can update team announcements" on public.team_announcements;
drop policy if exists "Creators and owners can delete team announcements" on public.team_announcements;
create policy "Players and sport managers can read announcements" on public.team_announcements for select to authenticated using (
  (select public.current_user_can_manage_sport())
  or (
    status = 'published' and (select public.current_user_is_active_player())
    and exists (
      select 1 from public.season_players sp
      where sp.season_id = team_announcements.season_id and sp.player_id = (select auth.uid())
        and team_announcements.announcement_date >= sp.active_from
        and (sp.active_until is null or team_announcements.announcement_date <= sp.active_until)
    )
  )
);
create policy "Sport managers can create announcements" on public.team_announcements for insert to authenticated
with check ((select public.current_user_can_manage_sport()) and created_by = (select auth.uid()));
create policy "Sport managers can update announcements" on public.team_announcements for update to authenticated
using ((select public.current_user_can_manage_sport())) with check ((select public.current_user_can_manage_sport()));
create policy "Sport managers can delete announcements" on public.team_announcements for delete to authenticated
using ((select public.current_user_can_manage_sport()));
