-- Instantáneas históricas de la competición pública de MatchReady.
-- La aplicación nunca depende de que una temporada antigua siga publicada.

create table public.competition_seasons (
  id text primary key,
  name text not null,
  starts_on date not null,
  source_label text not null default 'MatchReady · Federación Aragonesa de Rugby',
  source_url text not null,
  synced_at timestamptz not null default now()
);

create table public.competition_fixtures (
  id text primary key,
  competition_season_id text not null references public.competition_seasons(id) on delete cascade,
  source_match_id text,
  round text not null,
  round_order integer not null default 0,
  match_date date not null,
  kickoff_time time,
  home_team text not null,
  away_team text not null,
  home_score integer,
  away_score integer,
  status text not null check (status in ('scheduled', 'final', 'postponed')),
  unique (competition_season_id, source_match_id)
);

create table public.competition_standings (
  competition_season_id text not null references public.competition_seasons(id) on delete cascade,
  position integer not null,
  team text not null,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  points_for integer not null default 0,
  points_against integer not null default 0,
  difference integer not null default 0,
  offensive_bonus integer not null default 0,
  defensive_bonus integer not null default 0,
  points integer not null default 0,
  primary key (competition_season_id, team)
);

create table public.competition_player_stats (
  competition_season_id text not null references public.competition_seasons(id) on delete cascade,
  player text not null,
  team text not null,
  points integer not null default 0,
  tries integer not null default 0,
  conversions integer not null default 0,
  penalties integer not null default 0,
  drops integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  primary key (competition_season_id, team, player)
);

create index competition_fixtures_season_date_idx
  on public.competition_fixtures (competition_season_id, match_date);
create index competition_standings_season_position_idx
  on public.competition_standings (competition_season_id, position);
create index competition_player_stats_season_points_idx
  on public.competition_player_stats (competition_season_id, points desc);

alter table public.competition_seasons enable row level security;
alter table public.competition_fixtures enable row level security;
alter table public.competition_standings enable row level security;
alter table public.competition_player_stats enable row level security;

create policy "Approved users can read competition seasons"
on public.competition_seasons for select to authenticated
using ((select public.current_user_is_approved()));

create policy "Approved users can read competition fixtures"
on public.competition_fixtures for select to authenticated
using ((select public.current_user_is_approved()));

create policy "Approved users can read competition standings"
on public.competition_standings for select to authenticated
using ((select public.current_user_is_approved()));

create policy "Approved users can read competition player stats"
on public.competition_player_stats for select to authenticated
using ((select public.current_user_is_approved()));

