-- Calendario de cumpleaños seguro para jugadoras. Expone únicamente la
-- ocurrencia dentro de la temporada activa, nunca el año de nacimiento ni la edad.

create or replace function public.get_player_season_birthday_calendar()
returns table (
  season_id uuid,
  player_id uuid,
  display_name text,
  birthday_on date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today_in_madrid date := (pg_catalog.now() at time zone 'Europe/Madrid')::date;
begin
  if not exists (
    select 1
    from public.profiles requester
    join public.season_players requester_membership
      on requester_membership.player_id = requester.id
    join public.seasons requester_season
      on requester_season.id = requester_membership.season_id
    where requester.id = (select auth.uid())
      and requester.is_player
      and requester.is_approved
      and requester.is_active
      and not requester.is_archived
      and today_in_madrid between requester_season.start_date and requester_season.end_date
      and today_in_madrid >= requester_membership.active_from
      and (requester_membership.active_until is null or today_in_madrid <= requester_membership.active_until)
  ) then
    raise exception 'Solo las jugadoras activas de la temporada pueden consultar este calendario';
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
    occurrence.birthday_on
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

revoke all on function public.get_player_season_birthday_calendar() from public;
grant execute on function public.get_player_season_birthday_calendar() to authenticated;
