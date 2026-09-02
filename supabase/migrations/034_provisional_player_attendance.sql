-- Invitadas que todavía no tienen una cuenta de Google en la aplicación.
-- Se mantienen fuera de profiles porque esa tabla depende de auth.users.
create table public.provisional_players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  linked_profile_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  linked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  linked_at timestamptz,

  constraint provisional_players_display_name_valid
    check (length(trim(display_name)) between 3 and 80),
  constraint provisional_players_link_state_valid
    check (
      (linked_at is null and linked_profile_id is null and linked_by is null)
      or (linked_at is not null and linked_profile_id is not null and linked_by is not null)
    )
);

-- Solo se guarda una fila cuando la invitada asistió. Al no formar todavía
-- parte de la plantilla, nunca se genera para ella una ausencia.
create table public.provisional_training_attendance (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  provisional_player_id uuid not null references public.provisional_players(id),
  marked_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (session_id, provisional_player_id)
);

create index provisional_players_unlinked_name_idx
  on public.provisional_players (lower(display_name))
  where linked_at is null;

create index provisional_training_attendance_player_idx
  on public.provisional_training_attendance (provisional_player_id);

create trigger provisional_players_set_updated_at
before update on public.provisional_players
for each row execute function public.set_updated_at();

create trigger provisional_training_attendance_set_updated_at
before update on public.provisional_training_attendance
for each row execute function public.set_updated_at();

alter table public.provisional_players enable row level security;
alter table public.provisional_training_attendance enable row level security;

create policy "Team staff can read provisional players"
on public.provisional_players for select to authenticated
using ((select public.current_user_can_view_team_data()));

create policy "Team staff can read provisional attendance"
on public.provisional_training_attendance for select to authenticated
using ((select public.current_user_can_view_team_data()));

-- Las escrituras se realizan únicamente mediante las RPC protegidas.
revoke all on table public.provisional_players from anon, authenticated;
revoke all on table public.provisional_training_attendance from anon, authenticated;
grant select on table public.provisional_players to authenticated;
grant select on table public.provisional_training_attendance to authenticated;

-- Sustituye la RPC anterior por una versión que guarda de forma atómica
-- jugadoras registradas e invitadas.
drop function public.save_training_attendance(date, uuid[], uuid[]);

create or replace function public.save_training_attendance(
  attendance_date date,
  checked_player_ids uuid[],
  attended_player_ids uuid[],
  guest_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked_session_id uuid;
  checked_season_id uuid;
  checked_guest_id uuid;
  checked_guest_name text;
  checked_guest_ids uuid[] := array[]::uuid[];
  guest_entry jsonb;
begin
  if not public.current_user_can_manage_sport() then
    raise exception 'No tienes permiso para guardar asistencia';
  end if;

  if guest_entries is null or jsonb_typeof(guest_entries) <> 'array' then
    raise exception 'La lista de invitadas no es válida';
  end if;

  select s.id into checked_season_id
  from public.seasons s
  where attendance_date between s.start_date and s.end_date;

  if checked_season_id is null then
    raise exception 'No hay una temporada que incluya la fecha del entrenamiento';
  end if;

  if exists (
    select 1
    from unnest(checked_player_ids) as selected_player(player_id)
    left join public.profiles p on p.id = selected_player.player_id
    left join public.season_players sp
      on sp.season_id = checked_season_id
      and sp.player_id = selected_player.player_id
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
  on conflict (session_date) do update
    set season_id = excluded.season_id, updated_at = now()
  returning training_sessions.id into checked_session_id;

  delete from public.training_attendance ta
  where ta.session_id = checked_session_id
    and not (ta.player_id = any(checked_player_ids));

  insert into public.training_attendance (session_id, player_id, attended, marked_by)
  select checked_session_id, selected_player.player_id,
    selected_player.player_id = any(attended_player_ids), auth.uid()
  from unnest(checked_player_ids) as selected_player(player_id)
  on conflict on constraint training_attendance_pkey do update
    set attended = excluded.attended,
        marked_by = auth.uid(),
        updated_at = now();

  for guest_entry in select value from jsonb_array_elements(guest_entries)
  loop
    checked_guest_id := null;

    if nullif(guest_entry->>'id', '') is not null then
      begin
        checked_guest_id := (guest_entry->>'id')::uuid;
      exception when invalid_text_representation then
        raise exception 'La invitada seleccionada no es válida';
      end;

      if not exists (
        select 1 from public.provisional_players pp
        where pp.id = checked_guest_id and pp.linked_at is null
      ) then
        raise exception 'La invitada ya no está disponible';
      end if;
    else
      checked_guest_name := regexp_replace(trim(coalesce(guest_entry->>'displayName', '')), '\s+', ' ', 'g');
      if length(checked_guest_name) < 3 or length(checked_guest_name) > 80
        or checked_guest_name !~ '\S+\s+\S+'
      then
        raise exception 'Escribe el nombre y al menos un apellido de la invitada';
      end if;

      insert into public.provisional_players (display_name, created_by)
      values (checked_guest_name, auth.uid())
      returning id into checked_guest_id;
    end if;

    checked_guest_ids := array_append(checked_guest_ids, checked_guest_id);
  end loop;

  if cardinality(checked_guest_ids) <> (
    select count(distinct guest_id) from unnest(checked_guest_ids) as guests(guest_id)
  ) then
    raise exception 'Una invitada aparece más de una vez';
  end if;

  delete from public.provisional_training_attendance pta
  where pta.session_id = checked_session_id
    and not (pta.provisional_player_id = any(checked_guest_ids));

  insert into public.provisional_training_attendance (
    session_id,
    provisional_player_id,
    marked_by
  )
  select checked_session_id, guest_id, auth.uid()
  from unnest(checked_guest_ids) as guests(guest_id)
  on conflict on constraint provisional_training_attendance_pkey do update
    set marked_by = auth.uid(), updated_at = now();
end;
$$;

revoke all on function public.save_training_attendance(date, uuid[], uuid[], jsonb) from public;
grant execute on function public.save_training_attendance(date, uuid[], uuid[], jsonb) to authenticated;

-- Una PWA instalada puede conservar temporalmente la versión anterior del
-- cliente. Esta envoltura mantiene sus guardados y preserva las invitadas que
-- ya estuvieran registradas para la fecha.
create or replace function public.save_training_attendance(
  attendance_date date,
  checked_player_ids uuid[],
  attended_player_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  preserved_guest_entries jsonb;
begin
  select coalesce(
    jsonb_agg(jsonb_build_object('id', pta.provisional_player_id)),
    '[]'::jsonb
  ) into preserved_guest_entries
  from public.training_sessions ts
  join public.provisional_training_attendance pta on pta.session_id = ts.id
  where ts.session_date = attendance_date;

  perform public.save_training_attendance(
    attendance_date,
    checked_player_ids,
    attended_player_ids,
    preserved_guest_entries
  );
end;
$$;

revoke all on function public.save_training_attendance(date, uuid[], uuid[]) from public;
grant execute on function public.save_training_attendance(date, uuid[], uuid[]) to authenticated;

-- El owner confirma la identidad. El histórico pasa al perfil real, se amplía
-- su pertenencia a la temporada y la invitada deja de aparecer como pendiente.
create or replace function public.link_provisional_player(
  checked_provisional_player_id uuid,
  checked_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked_provisional public.provisional_players%rowtype;
  season_history record;
begin
  if not public.current_user_is_owner() then
    raise exception 'Solo el owner puede vincular asistencias de invitadas';
  end if;

  select * into checked_provisional
  from public.provisional_players pp
  where pp.id = checked_provisional_player_id
  for update;

  if not found or checked_provisional.linked_at is not null then
    raise exception 'La invitada ya no está disponible';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = checked_profile_id
      and p.is_player
      and not p.is_archived
  ) then
    raise exception 'El perfil seleccionado no puede recibir asistencias de jugadora';
  end if;

  insert into public.training_attendance (
    session_id,
    player_id,
    attended,
    marked_by
  )
  select pta.session_id, checked_profile_id, true, auth.uid()
  from public.provisional_training_attendance pta
  where pta.provisional_player_id = checked_provisional_player_id
  on conflict on constraint training_attendance_pkey do update
    set attended = true, marked_by = auth.uid(), updated_at = now();

  for season_history in
    select ts.season_id,
      min(ts.session_date) as first_attendance,
      max(ts.session_date) as last_attendance,
      max(s.end_date) as season_end
    from public.provisional_training_attendance pta
    join public.training_sessions ts on ts.id = pta.session_id
    join public.seasons s on s.id = ts.season_id
    where pta.provisional_player_id = checked_provisional_player_id
    group by ts.season_id
  loop
    update public.season_players sp
    set active_from = least(sp.active_from, season_history.first_attendance)
    where sp.season_id = season_history.season_id
      and sp.player_id = checked_profile_id
      and sp.active_until is null;

    if not found and not exists (
      select 1 from public.season_players sp
      where sp.season_id = season_history.season_id
        and sp.player_id = checked_profile_id
        and sp.active_from <= season_history.first_attendance
        and (sp.active_until is null or sp.active_until >= season_history.last_attendance)
    ) then
      insert into public.season_players (
        season_id,
        player_id,
        active_from,
        active_until
      ) values (
        season_history.season_id,
        checked_profile_id,
        season_history.first_attendance,
        case
          when season_history.season_end < (now() at time zone 'Europe/Madrid')::date
            then season_history.last_attendance
          else null
        end
      );
    end if;
  end loop;

  delete from public.provisional_training_attendance
  where provisional_player_id = checked_provisional_player_id;

  update public.provisional_players
  set linked_profile_id = checked_profile_id,
      linked_by = auth.uid(),
      linked_at = now(),
      updated_at = now()
  where id = checked_provisional_player_id;
end;
$$;

revoke all on function public.link_provisional_player(uuid, uuid) from public;
grant execute on function public.link_provisional_player(uuid, uuid) to authenticated;
