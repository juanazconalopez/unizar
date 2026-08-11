-- Avisos del equipo con fecha exacta. No son tareas y no generan respuestas
-- ni afectan a las estadísticas de entrenamiento.
create table public.team_announcements (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  announcement_date date not null,
  title text not null,
  description text,
  status public.task_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_announcements_title_not_empty
    check (length(trim(title)) > 0)
);

create index team_announcements_season_date_idx
  on public.team_announcements (season_id, announcement_date);

create trigger team_announcements_set_updated_at
before update on public.team_announcements
for each row execute function public.set_updated_at();

alter table public.team_announcements enable row level security;

create or replace function public.guard_announcement_season_dates()
returns trigger language plpgsql set search_path = '' as $$
declare
  checked_start date;
  checked_end date;
begin
  select start_date, end_date into checked_start, checked_end
  from public.seasons where id = new.season_id;
  if checked_start is null or new.announcement_date not between checked_start and checked_end then
    raise exception 'La fecha del aviso debe estar dentro de la temporada';
  end if;
  return new;
end;
$$;

create trigger team_announcements_guard_season_dates
before insert or update of season_id, announcement_date on public.team_announcements
for each row execute function public.guard_announcement_season_dates();

create or replace function public.guard_season_dependent_dates()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.tasks t where t.season_id = old.id and (t.week_start < new.start_date or t.week_start + 6 > new.end_date)) then
    raise exception 'La temporada no puede dejar tareas fuera de sus fechas';
  end if;
  if exists (select 1 from public.matches m where m.season_id = old.id and m.match_date not between new.start_date and new.end_date) then
    raise exception 'La temporada no puede dejar partidos fuera de sus fechas';
  end if;
  if exists (select 1 from public.training_sessions ts where ts.season_id = old.id and ts.session_date not between new.start_date and new.end_date) then
    raise exception 'La temporada no puede dejar entrenamientos de campo fuera de sus fechas';
  end if;
  if exists (select 1 from public.team_announcements a where a.season_id = old.id and a.announcement_date not between new.start_date and new.end_date) then
    raise exception 'La temporada no puede dejar avisos fuera de sus fechas';
  end if;
  return new;
end;
$$;

create policy "Players can read published team announcements"
on public.team_announcements
for select
to authenticated
using (
  (
    status = 'published'
    and (select public.current_user_is_active_player())
    and exists (
      select 1
      from public.season_players
      where season_players.season_id = team_announcements.season_id
        and season_players.player_id = (select auth.uid())
        and team_announcements.announcement_date >= season_players.active_from
        and (
          season_players.active_until is null
          or team_announcements.announcement_date <= season_players.active_until
        )
    )
  )
  or (select public.current_user_can_manage_tasks())
);

create policy "Collaborators can create team announcements"
on public.team_announcements
for insert
to authenticated
with check (
  (select public.current_user_can_manage_tasks())
  and created_by = (select auth.uid())
);

create policy "Creators and owners can update team announcements"
on public.team_announcements
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

create policy "Creators and owners can delete team announcements"
on public.team_announcements
for delete
to authenticated
using (
  (select public.current_user_is_owner())
  or (
    (select public.current_user_can_manage_tasks())
    and created_by = (select auth.uid())
  )
);
