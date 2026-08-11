-- Reglas de integridad que no deben depender del navegador.

alter table public.seasons
  add constraint seasons_dates_do_not_overlap
  exclude using gist (daterange(start_date, end_date, '[]') with &&);

create or replace function public.guard_season_dependent_dates()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.tasks t
    where t.season_id = old.id
      and (t.week_start < new.start_date or t.week_start + 6 > new.end_date)
  ) then
    raise exception 'La temporada no puede dejar tareas fuera de sus fechas';
  end if;

  if exists (
    select 1 from public.matches m
    where m.season_id = old.id
      and m.match_date not between new.start_date and new.end_date
  ) then
    raise exception 'La temporada no puede dejar partidos fuera de sus fechas';
  end if;

  if exists (
    select 1 from public.training_sessions ts
    where ts.season_id = old.id
      and ts.session_date not between new.start_date and new.end_date
  ) then
    raise exception 'La temporada no puede dejar entrenamientos de campo fuera de sus fechas';
  end if;

  return new;
end;
$$;

create trigger seasons_guard_dependent_dates
before update of start_date, end_date on public.seasons
for each row execute function public.guard_season_dependent_dates();

create or replace function public.guard_task_season_dates()
returns trigger language plpgsql set search_path = '' as $$
declare
  checked_start date;
  checked_end date;
begin
  select start_date, end_date into checked_start, checked_end
  from public.seasons where id = new.season_id;

  if checked_start is null or new.week_start < checked_start or new.week_start + 6 > checked_end then
    raise exception 'La semana completa de la tarea debe estar dentro de la temporada';
  end if;
  return new;
end;
$$;

create trigger tasks_guard_season_dates
before insert or update of season_id, week_start on public.tasks
for each row execute function public.guard_task_season_dates();

create or replace function public.guard_match_season_dates()
returns trigger language plpgsql set search_path = '' as $$
declare
  checked_start date;
  checked_end date;
begin
  select start_date, end_date into checked_start, checked_end
  from public.seasons where id = new.season_id;

  if checked_start is null or new.match_date not between checked_start and checked_end then
    raise exception 'La fecha del partido debe estar dentro de la temporada';
  end if;
  return new;
end;
$$;

create trigger matches_guard_season_dates
before insert or update of season_id, match_date on public.matches
for each row execute function public.guard_match_season_dates();

-- Una convocatoria publicada es una instantánea inmutable.
create or replace function public.guard_published_lineup_rows()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  checked_match_id uuid := coalesce(new.match_id, old.match_id);
begin
  if exists (
    select 1 from public.matches
    where id = checked_match_id and lineup_published
  ) then
    raise exception 'La convocatoria publicada ya no se puede modificar';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger match_lineup_guard_published
before insert or update or delete on public.match_lineup
for each row execute function public.guard_published_lineup_rows();

create or replace function public.guard_published_match_structure()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.lineup_published and (
    new.season_id is distinct from old.season_id
    or new.match_date is distinct from old.match_date
    or new.match_kind is distinct from old.match_kind
    or new.rugby_format is distinct from old.rugby_format
  ) then
    raise exception 'No se puede cambiar la fecha, temporada o formato de un partido con convocatoria publicada';
  end if;
  return new;
end;
$$;

create trigger matches_guard_published_structure
before update on public.matches
for each row execute function public.guard_published_match_structure();

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
      or not p.is_approved or not p.is_active or p.is_archived or p.is_owner
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

-- La asistencia pertenece a una temporada y se guarda en una sola transacción.
alter table public.training_sessions
  add column season_id uuid references public.seasons(id) on delete cascade;

update public.training_sessions ts
set season_id = (
  select s.id from public.seasons s
  where ts.session_date between s.start_date and s.end_date
  order by s.start_date desc limit 1
)
where season_id is null;

create index training_sessions_season_date_idx
  on public.training_sessions (season_id, session_date desc);

create or replace function public.guard_training_session_season()
returns trigger language plpgsql set search_path = '' as $$
declare
  matching_season uuid;
begin
  if new.season_id is null then
    select id into matching_season from public.seasons
    where new.session_date between start_date and end_date;
    new.season_id := matching_season;
  end if;

  if new.season_id is null or not exists (
    select 1 from public.seasons
    where id = new.season_id and new.session_date between start_date and end_date
  ) then
    raise exception 'No hay una temporada que incluya la fecha del entrenamiento';
  end if;
  return new;
end;
$$;

create trigger training_sessions_guard_season
before insert or update of session_date, season_id on public.training_sessions
for each row execute function public.guard_training_session_season();

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
  if not public.current_user_is_owner() then
    raise exception 'Solo el owner puede guardar asistencia';
  end if;

  select id into checked_season_id from public.seasons
  where attendance_date between start_date and end_date;
  if checked_season_id is null then
    raise exception 'No hay una temporada que incluya la fecha del entrenamiento';
  end if;

  if exists (
    select 1 from unnest(checked_player_ids) player_id
    left join public.profiles p on p.id = player_id
    left join public.season_players sp
      on sp.season_id = checked_season_id and sp.player_id = player_id
      and sp.active_from <= attendance_date
      and (sp.active_until is null or sp.active_until >= attendance_date)
    where p.id is null or p.is_owner or sp.id is null
  ) then
    raise exception 'La asistencia contiene una jugadora no elegible para esa fecha';
  end if;

  if exists (
    select 1 from unnest(attended_player_ids) player_id
    where not (player_id = any(checked_player_ids))
  ) then
    raise exception 'Una asistente no forma parte del listado del entrenamiento';
  end if;

  insert into public.training_sessions (session_date, season_id, created_by)
  values (attendance_date, checked_season_id, auth.uid())
  on conflict (session_date) do update
    set season_id = excluded.season_id, updated_at = now()
  returning id into checked_session_id;

  delete from public.training_attendance
  where session_id = checked_session_id
    and not (player_id = any(checked_player_ids));

  insert into public.training_attendance (session_id, player_id, attended, marked_by)
  select checked_session_id, player_id, player_id = any(attended_player_ids), auth.uid()
  from unnest(checked_player_ids) player_id
  on conflict (session_id, player_id) do update
    set attended = excluded.attended, marked_by = auth.uid(), updated_at = now();
end;
$$;

grant execute on function public.save_training_attendance(date, uuid[], uuid[]) to authenticated;

-- Los gestores leen resultados, pero solo la jugadora modifica su respuesta.
drop policy "Players can update their own results" on public.task_results;
create policy "Players can update their own results"
on public.task_results for update to authenticated
using (player_id = (select auth.uid()))
with check (
  player_id = (select auth.uid())
  and public.player_can_complete_task(task_id, player_id, performed_on)
);
drop policy "Owners can delete results" on public.task_results;

-- Registro operativo y reemplazo atómico de la competición.
create table public.competition_sync_runs (
  id uuid primary key default gen_random_uuid(),
  competition_season_id text references public.competition_seasons(id) on delete set null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  fixtures_count integer,
  standings_count integer,
  player_stats_count integer,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.competition_sync_runs enable row level security;
create policy "Owners can read competition sync runs"
on public.competition_sync_runs for select to authenticated
using ((select public.current_user_is_owner()));

create or replace function public.replace_competition_snapshot(
  checked_season jsonb,
  checked_fixtures jsonb,
  checked_standings jsonb,
  checked_player_stats jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  season_id text := checked_season->>'id';
begin
  if jsonb_array_length(checked_fixtures) = 0 or jsonb_array_length(checked_standings) = 0 then
    raise exception 'La instantánea debe contener partidos y clasificación';
  end if;

  insert into public.competition_seasons (id, name, starts_on, source_label, source_url, synced_at)
  values (
    season_id,
    checked_season->>'name',
    (checked_season->>'starts_on')::date,
    checked_season->>'source_label',
    checked_season->>'source_url',
    (checked_season->>'synced_at')::timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    starts_on = excluded.starts_on,
    source_label = excluded.source_label,
    source_url = excluded.source_url,
    synced_at = excluded.synced_at;

  insert into public.competition_fixtures (
    id, competition_season_id, source_match_id, round, round_order, match_date,
    kickoff_time, home_team, away_team, home_score, away_score, status
  )
  select id, competition_season_id, source_match_id, round, round_order, match_date,
    kickoff_time, home_team, away_team, home_score, away_score, status
  from jsonb_to_recordset(checked_fixtures) as row(
    id text, competition_season_id text, source_match_id text, round text,
    round_order integer, match_date date, kickoff_time time, home_team text,
    away_team text, home_score integer, away_score integer, status text
  )
  on conflict (id) do update set
    source_match_id = excluded.source_match_id, round = excluded.round,
    round_order = excluded.round_order, match_date = excluded.match_date,
    kickoff_time = excluded.kickoff_time, home_team = excluded.home_team,
    away_team = excluded.away_team, home_score = excluded.home_score,
    away_score = excluded.away_score, status = excluded.status;

  delete from public.competition_fixtures current
  where current.competition_season_id = season_id
    and not exists (
      select 1 from jsonb_array_elements(checked_fixtures) item
      where item->>'id' = current.id
    );

  insert into public.competition_standings (
    competition_season_id, position, team, played, won, drawn, lost,
    points_for, points_against, difference, offensive_bonus, defensive_bonus, points
  )
  select competition_season_id, position, team, played, won, drawn, lost,
    points_for, points_against, difference, offensive_bonus, defensive_bonus, points
  from jsonb_to_recordset(checked_standings) as row(
    competition_season_id text, position integer, team text, played integer,
    won integer, drawn integer, lost integer, points_for integer,
    points_against integer, difference integer, offensive_bonus integer,
    defensive_bonus integer, points integer
  )
  on conflict (competition_season_id, team) do update set
    position = excluded.position, played = excluded.played, won = excluded.won,
    drawn = excluded.drawn, lost = excluded.lost, points_for = excluded.points_for,
    points_against = excluded.points_against, difference = excluded.difference,
    offensive_bonus = excluded.offensive_bonus, defensive_bonus = excluded.defensive_bonus,
    points = excluded.points;

  delete from public.competition_standings current
  where current.competition_season_id = season_id
    and not exists (
      select 1 from jsonb_array_elements(checked_standings) item
      where item->>'team' = current.team
    );

  insert into public.competition_player_stats (
    competition_season_id, player, team, points, tries, conversions,
    penalties, drops, yellow_cards, red_cards
  )
  select competition_season_id, player, team, points, tries, conversions,
    penalties, drops, yellow_cards, red_cards
  from jsonb_to_recordset(checked_player_stats) as row(
    competition_season_id text, player text, team text, points integer,
    tries integer, conversions integer, penalties integer, drops integer,
    yellow_cards integer, red_cards integer
  )
  on conflict (competition_season_id, team, player) do update set
    points = excluded.points, tries = excluded.tries,
    conversions = excluded.conversions, penalties = excluded.penalties,
    drops = excluded.drops, yellow_cards = excluded.yellow_cards,
    red_cards = excluded.red_cards;

  delete from public.competition_player_stats current
  where current.competition_season_id = season_id
    and not exists (
      select 1 from jsonb_array_elements(checked_player_stats) item
      where item->>'team' = current.team and item->>'player' = current.player
    );
end;
$$;

revoke all on function public.replace_competition_snapshot(jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_competition_snapshot(jsonb, jsonb, jsonb, jsonb) to service_role;
