-- Colores configurables por equipo de temporada. Ejecutar en Supabase SQL Editor.
begin;

alter table public.season_teams add column color text;

-- El equipo predeterminado empieza en morado, el segundo competitivo en verde.
-- Se respetan las vinculaciones y los colores de las competiciones.
with ranked_teams as (
  select id, row_number() over (
    partition by season_id order by is_default desc, is_mixed asc, created_at, id
  ) as position
  from public.season_teams
)
update public.season_teams team
set color = (array['purple', 'green', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold'])[((ranked.position - 1) % 9 + 1)::integer]
from ranked_teams ranked
where team.id = ranked.id;

alter table public.season_teams
  alter column color set default 'purple',
  alter column color set not null,
  add constraint season_teams_color_check check (color in ('purple', 'green', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold'));

-- Evitar sobrecargas ambiguas en PostgREST; el cliente envía el color explícito.
drop function public.create_season_team(uuid, text, boolean);
drop function public.update_season_team(uuid, text, boolean, boolean);

create or replace function public.create_season_team(checked_season_id uuid, checked_name text, checked_is_mixed boolean, checked_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_team_id uuid;
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede gestionar los equipos de la temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para el equipo';
  end if;
  if checked_color is null or checked_color not in ('purple', 'green', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold') then
    raise exception 'Selecciona un color válido para el equipo';
  end if;
  perform 1 from public.seasons where id = checked_season_id for update;
  if not found then raise exception 'La temporada no existe'; end if;

  insert into public.season_teams (season_id, name, is_mixed, color, created_by)
  values (checked_season_id, trim(checked_name), coalesce(checked_is_mixed, false), checked_color, (select auth.uid()))
  returning id into created_team_id;
  return created_team_id;
end;
$$;

create or replace function public.update_season_team(checked_team_id uuid, checked_name text, checked_is_mixed boolean, checked_is_active boolean, checked_color text)
returns void language plpgsql security definer set search_path = '' as $$
declare old_name text;
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede gestionar los equipos de la temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para el equipo';
  end if;
  if checked_color is null or checked_color not in ('purple', 'green', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold') then
    raise exception 'Selecciona un color válido para el equipo';
  end if;
  select name into old_name from public.season_teams where id = checked_team_id for update;
  if not found then raise exception 'El equipo no existe'; end if;
  if checked_is_active = false and exists (
    select 1 from public.season_players where season_team_id = checked_team_id and active_until is null
  ) then raise exception 'Reasigna primero a las jugadoras activas de este equipo'; end if;
  if checked_is_mixed = true and exists (
    select 1 from public.matches where team_id = checked_team_id and internal_fixture_id is not null
  ) then raise exception 'Un equipo que participa en un derbi no puede convertirse en mixto'; end if;

  update public.season_teams
  set color = checked_color, name = trim(checked_name), is_mixed = coalesce(checked_is_mixed, false), is_active = coalesce(checked_is_active, true)
  where id = checked_team_id;

  if old_name is distinct from trim(checked_name) then
    perform set_config('app.internal_fixture_write', 'yes', true);
    update public.matches other_match set opponent = trim(checked_name)
    where other_match.internal_fixture_id is not null and exists (
      select 1 from public.matches team_match
      where team_match.internal_fixture_id = other_match.internal_fixture_id
        and team_match.team_id = checked_team_id and team_match.id <> other_match.id
    );
  end if;
end;
$$;

revoke all on function public.create_season_team(uuid, text, boolean, text) from public, anon;
grant execute on function public.create_season_team(uuid, text, boolean, text) to authenticated;
revoke all on function public.update_season_team(uuid, text, boolean, boolean, text) from public, anon;
grant execute on function public.update_season_team(uuid, text, boolean, boolean, text) to authenticated;

commit;
