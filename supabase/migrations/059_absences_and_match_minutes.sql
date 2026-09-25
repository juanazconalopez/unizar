-- Bajas y minutos. La baja no desactiva la cuenta: conserva el historial y
-- excluye a la jugadora de la actividad deportiva durante su intervalo.

create type public.match_event_type as enum ('substitution', 'yellow_card', 'red_card');

create table public.player_absences (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_absences_dates_check check (ends_on is null or ends_on >= starts_on)
);
create index player_absences_player_dates_idx on public.player_absences (player_id, starts_on, ends_on);

create table public.player_absence_private_notes (
  absence_id uuid primary key references public.player_absences(id) on delete cascade,
  note text not null check (length(trim(note)) between 1 and 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id)
);

alter table public.matches
  add column duration_minutes smallint not null default 80 check (duration_minutes between 1 and 240),
  add column match_report_path text;

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  event_minute smallint not null check (event_minute between 0 and 240),
  event_type public.match_event_type not null,
  player_id uuid not null references public.profiles(id) on delete restrict,
  replacement_player_id uuid references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint match_events_substitution_check check (
    (event_type = 'substitution'::public.match_event_type and replacement_player_id is not null and replacement_player_id <> player_id)
    or (event_type <> 'substitution'::public.match_event_type and replacement_player_id is null)
  )
);
create index match_events_match_minute_idx on public.match_events (match_id, event_minute, created_at);

create trigger player_absences_set_updated_at before update on public.player_absences
for each row execute function public.set_updated_at();
alter table public.player_absences enable row level security;
alter table public.player_absence_private_notes enable row level security;
alter table public.match_events enable row level security;

create or replace function public.player_has_absence_on(checked_player_id uuid, checked_date date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.player_absences absence
    where absence.player_id = checked_player_id
      and absence.starts_on <= checked_date
      and (absence.ends_on is null or absence.ends_on >= checked_date)
  );
$$;

create or replace function public.guard_player_absence_overlap()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.player_absences absence
    where absence.player_id = new.player_id and absence.id <> coalesce(new.id, gen_random_uuid())
      and daterange(absence.starts_on, coalesce(absence.ends_on, 'infinity'::date), '[]')
        && daterange(new.starts_on, coalesce(new.ends_on, 'infinity'::date), '[]')
  ) then raise exception 'La baja se solapa con otra baja ya registrada para esta jugadora'; end if;
  return new;
end;
$$;
create trigger player_absences_guard_overlap before insert or update of player_id, starts_on, ends_on
on public.player_absences for each row execute function public.guard_player_absence_overlap();

create policy "Players and scoped staff can read absences" on public.player_absences for select to authenticated using (
  player_id = (select auth.uid()) or (select public.current_user_can_view_team_data())
);
create policy "Owners manage player absences" on public.player_absences for all to authenticated
using ((select public.current_user_is_owner())) with check ((select public.current_user_is_owner()));
create policy "Owners read absence notes" on public.player_absence_private_notes for select to authenticated
using ((select public.current_user_is_owner()));
create policy "Owners manage absence notes" on public.player_absence_private_notes for all to authenticated
using ((select public.current_user_is_owner())) with check ((select public.current_user_is_owner()));
create policy "Scoped staff can read match events" on public.match_events for select to authenticated using (
  exists (select 1 from public.matches match where match.id = match_id and public.current_user_can_view_season_team(match.team_id))
);

create or replace function public.save_player_absence(
  checked_absence_id uuid,
  checked_player_id uuid,
  checked_starts_on date,
  checked_ends_on date,
  checked_private_note text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid;
declare normalized_note text := nullif(trim(coalesce(checked_private_note, '')), '');
begin
  if not public.current_user_is_owner() then raise exception 'Solo el owner puede registrar una baja'; end if;
  if checked_starts_on is null then raise exception 'Indica la fecha de inicio de la baja'; end if;
  if checked_ends_on is not null and checked_ends_on < checked_starts_on then raise exception 'La fecha de finalización no puede ser anterior al inicio'; end if;
  if checked_absence_id is null then
    insert into public.player_absences (player_id, starts_on, ends_on, created_by)
    values (checked_player_id, checked_starts_on, checked_ends_on, (select auth.uid())) returning id into saved_id;
  else
    update public.player_absences set player_id = checked_player_id, starts_on = checked_starts_on, ends_on = checked_ends_on
    where id = checked_absence_id returning id into saved_id;
    if not found then raise exception 'La baja no existe'; end if;
  end if;
  if normalized_note is null then
    delete from public.player_absence_private_notes where absence_id = saved_id;
  else
    insert into public.player_absence_private_notes (absence_id, note, updated_by)
    values (saved_id, normalized_note, (select auth.uid()))
    on conflict (absence_id) do update set note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
  end if;
  return saved_id;
end;
$$;

create or replace function public.delete_player_absence(checked_absence_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_is_owner() then raise exception 'Solo el owner puede eliminar una baja'; end if;
  delete from public.player_absences where id = checked_absence_id;
  if not found then raise exception 'La baja no existe'; end if;
end;
$$;

-- Una baja bloquea disponibilidad forzada, convocatoria y alineación; no
-- bloquea tareas ni acceso a la aplicación.
create or replace function public.player_can_access_match(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches match
    join public.season_players membership on membership.season_id = match.season_id and membership.player_id = checked_player_id
    join public.profiles player on player.id = checked_player_id
    where match.id = checked_match_id and match.status <> 'draft'
      and player.is_approved and player.is_active and not player.is_archived and player.is_player
      and membership.active_from <= match.match_date and (membership.active_until is null or membership.active_until >= match.match_date)
      and not public.player_has_absence_on(checked_player_id, match.match_date)
  );
$$;

create or replace function public.save_match_events(checked_match_id uuid, checked_events jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare match_duration smallint;
begin
  if not public.current_user_can_edit_match(checked_match_id) then raise exception 'No tienes permiso para registrar el acta'; end if;
  select duration_minutes into match_duration from public.matches where id = checked_match_id and match_kind = 'official'::public.match_kind;
  if not found then raise exception 'Solo los partidos oficiales tienen acta y minutos'; end if;
  if exists (
    select 1 from jsonb_array_elements(checked_events) item(event)
    where coalesce((event->>'event_minute')::smallint, -1) not between 0 and match_duration
      or coalesce(event->>'event_type', '') not in ('substitution', 'yellow_card', 'red_card')
  ) then raise exception 'El acta contiene un evento no válido'; end if;
  if exists (
    select 1 from jsonb_array_elements(checked_events) item(event)
    where not exists (select 1 from public.match_lineup lineup where lineup.match_id = checked_match_id and lineup.player_id = (item.event->>'player_id')::uuid)
      or ((item.event->>'event_type') = 'substitution' and not exists (select 1 from public.match_lineup lineup where lineup.match_id = checked_match_id and lineup.player_id = (item.event->>'replacement_player_id')::uuid))
  ) then raise exception 'El acta contiene una jugadora fuera de la convocatoria'; end if;
  delete from public.match_events where match_id = checked_match_id;
  insert into public.match_events (match_id, event_minute, event_type, player_id, replacement_player_id, created_by)
  select checked_match_id, (event->>'event_minute')::smallint, (event->>'event_type')::public.match_event_type,
    (event->>'player_id')::uuid, nullif(event->>'replacement_player_id', '')::uuid, (select auth.uid())
  from jsonb_array_elements(checked_events) item(event);
end;
$$;

create or replace function public.get_season_player_minutes(checked_season_id uuid)
returns table(player_id uuid, played_minutes integer)
language sql stable security definer set search_path = '' as $$
  with official_lineups as (
    select match.id as match_id, match.duration_minutes, lineup.player_id, lineup.role
    from public.matches match join public.match_lineup lineup on lineup.match_id = match.id
    where match.season_id = checked_season_id and match.match_kind = 'official'::public.match_kind and match.status = 'completed'::public.match_status
  ), intervals as (
    select lineup.*, case when lineup.role = 'starter'::public.lineup_role then 0 else coalesce((select min(event.event_minute) from public.match_events event where event.match_id = lineup.match_id and event.event_type = 'substitution'::public.match_event_type and event.replacement_player_id = lineup.player_id), lineup.duration_minutes) end as starts_at,
      coalesce((select min(event.event_minute) from public.match_events event where event.match_id = lineup.match_id and event.player_id = lineup.player_id and event.event_type in ('substitution'::public.match_event_type, 'red_card'::public.match_event_type)), lineup.duration_minutes) as ends_at
    from official_lineups lineup
  ), totals as (
    select interval.player_id, greatest(interval.ends_at - interval.starts_at - coalesce((select sum(greatest(0, least(interval.ends_at, event.event_minute + 10) - greatest(interval.starts_at, event.event_minute))) from public.match_events event where event.match_id = interval.match_id and event.player_id = interval.player_id and event.event_type = 'yellow_card'::public.match_event_type), 0), 0)::integer as minutes
    from intervals interval
  ) select player_id, sum(minutes)::integer from totals group by player_id;
$$;

revoke all on function public.save_player_absence(uuid,uuid,date,date,text), public.delete_player_absence(uuid), public.save_match_events(uuid,jsonb), public.get_season_player_minutes(uuid), public.player_has_absence_on(uuid,date) from public;
grant execute on function public.save_player_absence(uuid,uuid,date,date,text), public.delete_player_absence(uuid), public.save_match_events(uuid,jsonb), public.get_season_player_minutes(uuid), public.player_has_absence_on(uuid,date) to authenticated;
