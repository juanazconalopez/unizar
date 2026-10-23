-- Autoriza únicamente dentro del guardado validado las actualizaciones de las dos fichas del derbi.
create or replace function public.save_internal_match_report(
  checked_home_match_id uuid,
  checked_away_match_id uuid,
  checked_home_score integer,
  checked_away_score integer,
  checked_duration integer,
  checked_home_events jsonb,
  checked_away_events jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  home_match public.matches%rowtype;
  away_match public.matches%rowtype;
  today date := (pg_catalog.now() at time zone 'Europe/Madrid')::date;
  previous_fixture_write text := current_setting('app.internal_fixture_write', true);
begin
  if not public.current_user_has_permission('matches.edit')
    or not public.current_user_can_edit_match(checked_home_match_id)
    or not public.current_user_can_edit_match(checked_away_match_id) then
    raise exception 'No tienes permiso para registrar el acta de este derbi';
  end if;

  -- Bloquea ambas fichas en un orden estable para evitar guardados simultáneos.
  perform 1 from public.matches
    where id in (checked_home_match_id, checked_away_match_id)
    order by id for update;
  select * into home_match from public.matches where id = checked_home_match_id;
  select * into away_match from public.matches where id = checked_away_match_id;
  if home_match.id is null or away_match.id is null
    or home_match.id = away_match.id
    or home_match.internal_fixture_id is null
    or home_match.internal_fixture_id is distinct from away_match.internal_fixture_id
    or (select count(*) from public.matches fixture where fixture.internal_fixture_id = home_match.internal_fixture_id) <> 2
    or not home_match.is_home or away_match.is_home
    or home_match.season_id is distinct from away_match.season_id
    or home_match.match_date is distinct from away_match.match_date
    or home_match.match_kind <> 'official'::public.match_kind
    or away_match.match_kind <> 'official'::public.match_kind then
    raise exception 'Las dos fichas no pertenecen al mismo derbi oficial';
  end if;
  if home_match.match_date > today
    or home_match.status in ('draft'::public.match_status, 'cancelled'::public.match_status)
    or away_match.status in ('draft'::public.match_status, 'cancelled'::public.match_status) then
    raise exception 'Solo puedes registrar un derbi publicado que ya haya terminado';
  end if;
  if checked_home_score is null or checked_away_score is null
    or checked_home_score not between 0 and 250 or checked_away_score not between 0 and 250 then
    raise exception 'Revisa el resultado del partido';
  end if;
  if checked_duration is null or checked_duration not between 1 and 240 then
    raise exception 'Revisa la duración del partido';
  end if;
  if checked_home_events is null or jsonb_typeof(checked_home_events) <> 'array'
    or checked_away_events is null or jsonb_typeof(checked_away_events) <> 'array' then
    raise exception 'Revisa los eventos de los dos equipos';
  end if;
  if not home_match.lineup_published or not away_match.lineup_published
    or not exists (select 1 from public.match_lineup where match_id = home_match.id)
    or not exists (select 1 from public.match_lineup where match_id = away_match.id) then
    raise exception 'Publica las dos convocatorias antes de registrar los minutos';
  end if;
  if exists (
    select 1 from public.match_lineup lineup
    join public.matches target on target.id = lineup.match_id
    where lineup.match_id in (home_match.id, away_match.id)
      and not exists (
        select 1 from public.season_players membership
        where membership.player_id = lineup.player_id and membership.season_id = target.season_id
          and membership.active_from <= target.match_date
          and (membership.active_until is null or membership.active_until >= target.match_date)
      )
  ) then raise exception 'Revisa la vinculación de las jugadoras en la fecha del derbi'; end if;

  perform set_config('app.internal_fixture_write', 'yes', true);
  perform set_config('app.match_report_write', 'yes', true);
  update public.matches set team_score = checked_home_score, opponent_score = checked_away_score,
    duration_minutes = checked_duration, report_events_reviewed = true,
    status = 'completed'::public.match_status where id = home_match.id;
  update public.matches set team_score = checked_away_score, opponent_score = checked_home_score,
    duration_minutes = checked_duration, report_events_reviewed = true,
    status = 'completed'::public.match_status where id = away_match.id;
  perform public.save_match_events(home_match.id, checked_home_events);
  perform public.save_match_events(away_match.id, checked_away_events);
  perform set_config('app.match_report_write', '', true);
  perform set_config('app.internal_fixture_write', coalesce(previous_fixture_write, ''), true);
end;
$$;
