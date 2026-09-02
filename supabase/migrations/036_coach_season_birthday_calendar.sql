-- Owner y entrenadores necesitan el mismo contexto de cumpleaños dentro del
-- calendario deportivo. La función continúa sin estar disponible para
-- Dirección ni para jugadoras sin rol de gestión.

create or replace function public.get_active_season_birthdays()
returns table (
  season_id uuid,
  player_id uuid,
  display_name text,
  birthday_on date,
  age_turning integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today_in_madrid date := (pg_catalog.now() at time zone 'Europe/Madrid')::date;
begin
  if not public.current_user_can_manage_sport() then
    raise exception 'Solo owner y entrenadores pueden consultar los cumpleaños de la temporada';
  end if;

  return query
  with active_season as (
    select season.id, season.start_date, season.end_date
    from public.seasons season
    where today_in_madrid between season.start_date and season.end_date
    order by season.start_date desc
    limit 1
  ), occurrences as (
    select
      season.id as season_id,
      profile.id as player_id,
      profile.display_name,
      details.birth_date,
      pg_catalog.make_date(
        season_year,
        extract(month from details.birth_date)::integer,
        least(
          extract(day from details.birth_date)::integer,
          extract(day from (
            pg_catalog.make_date(season_year, extract(month from details.birth_date)::integer, 1)
            + interval '1 month - 1 day'
          ))::integer
        )
      ) as birthday_on
    from active_season season
    cross join lateral pg_catalog.generate_series(
      extract(year from season.start_date)::integer,
      extract(year from season.end_date)::integer
    ) as season_year
    join public.season_players membership on membership.season_id = season.id
    join public.profiles profile on profile.id = membership.player_id
    join public.profile_private_details details on details.profile_id = profile.id
    where profile.is_player
      and profile.is_approved
      and profile.is_active
      and not profile.is_archived
      and details.birth_date is not null
  )
  select distinct
    occurrence.season_id,
    occurrence.player_id,
    occurrence.display_name,
    occurrence.birthday_on,
    extract(year from occurrence.birthday_on)::integer - extract(year from occurrence.birth_date)::integer
  from occurrences occurrence
  join active_season season on season.id = occurrence.season_id
  join public.season_players membership
    on membership.season_id = occurrence.season_id
    and membership.player_id = occurrence.player_id
  where occurrence.birthday_on between season.start_date and season.end_date
    and occurrence.birthday_on >= membership.active_from
    and (membership.active_until is null or occurrence.birthday_on <= membership.active_until)
  order by occurrence.birthday_on, occurrence.display_name;
end;
$$;

revoke all on function public.get_active_season_birthdays() from public;
grant execute on function public.get_active_season_birthdays() to authenticated;
