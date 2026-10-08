-- Límite de siete convocadas de la última acta del otro equipo.
-- Activar por competición en Ajustes → Temporadas → Competiciones.
begin;

alter table public.season_competitions
  add column restrict_cross_team_callups boolean not null default false;

create index matches_cross_team_callup_idx
on public.matches (competition_id, match_date desc, kickoff_time desc, id desc)
where match_kind = 'official' and status in ('published','completed');

drop function public.create_season_competition(uuid,text,text,text,boolean);
drop function public.update_season_competition(uuid,text,text,text,boolean);

create or replace function public.create_season_competition(
  checked_season_id uuid,
  checked_name text,
  checked_color text,
  checked_level text default 'regional', checked_is_league boolean default false,
  checked_restrict_cross_team boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  created_id uuid;
  make_default boolean;
begin
  if checked_level is null or checked_level not in ('regional','national') then raise exception 'Nivel de competición no válido'; end if;
  if not public.current_user_has_permission('seasons.competitions') then
    raise exception 'Solo el owner puede gestionar las competiciones de una temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para la competición';
  end if;
  if checked_color not in ('purple', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold') then
    raise exception 'El color seleccionado no es válido';
  end if;

  perform 1 from public.seasons where id = checked_season_id for update;
  if not found then raise exception 'La temporada no existe'; end if;

  select not exists (
    select 1 from public.season_competitions where season_id = checked_season_id
  ) into make_default;

  insert into public.season_competitions (season_id, name, color, is_default, created_by)
  values (checked_season_id, trim(checked_name), checked_color, make_default, (select auth.uid()))
  returning id into created_id;
  update public.season_competitions set competition_level = checked_level,is_league = coalesce(checked_is_league,false),
    restrict_cross_team_callups = coalesce(checked_restrict_cross_team,false) where id = created_id;
  return created_id;
end;
$$;
create or replace function public.update_season_competition(
  checked_competition_id uuid,
  checked_name text,
  checked_color text,
  checked_level text default 'regional', checked_is_league boolean default false,
  checked_restrict_cross_team boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('seasons.competitions') then
    raise exception 'Solo el owner puede gestionar las competiciones de una temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para la competición';
  end if;
  if checked_color not in ('purple', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold') then
    raise exception 'El color seleccionado no es válido';
  end if;

  update public.season_competitions
  set name = trim(checked_name), color = checked_color, competition_level = checked_level,is_league = coalesce(checked_is_league,false),
    restrict_cross_team_callups = coalesce(checked_restrict_cross_team,restrict_cross_team_callups)
  where id = checked_competition_id;
  if not found then raise exception 'La competición no existe'; end if;
end;
$$;

-- Solo se devuelven identificadores públicos y el contexto deportivo mínimo.
-- Sin caché derivada: la referencia siempre es el último partido anterior real.
create function public.cross_team_callup_reference_internal(checked_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype;
declare previous public.matches%rowtype;
declare enabled boolean;
declare player_ids jsonb;
declare team_name text;
begin
  select * into target from public.matches where id = checked_match_id;
  if not found then raise exception 'El partido no existe'; end if;
  select competition.restrict_cross_team_callups into enabled
  from public.season_competitions competition where competition.id = target.competition_id;
  enabled := coalesce(enabled,false) and target.match_kind = 'official' and target.team_id is not null
    and target.status not in ('completed','cancelled');
  if enabled then
    select other.* into previous from public.matches other
    where other.season_id = target.season_id and other.competition_id = target.competition_id
      and other.match_kind = 'official' and other.status in ('published','completed')
      and other.team_id is not null and other.team_id <> target.team_id
      and (target.internal_fixture_id is null or other.internal_fixture_id is distinct from target.internal_fixture_id)
      and (other.match_date < target.match_date or (other.match_date = target.match_date
        and other.kickoff_time is not null and target.kickoff_time is not null
        and other.kickoff_time < target.kickoff_time))
    order by other.match_date desc, other.kickoff_time desc nulls last, other.id desc limit 1;
  end if;
  select coalesce(jsonb_agg(lineup.player_id order by lineup.player_id),'[]'::jsonb)
  into player_ids from public.match_lineup lineup where lineup.match_id = previous.id and previous.lineup_published;
  select name into team_name from public.season_teams where id = previous.team_id;
  return jsonb_build_object('enabled', enabled, 'matchId', previous.id,
    'teamName', team_name, 'matchDate', previous.match_date,
    'confirmed', coalesce(previous.status = 'completed' and previous.report_events_reviewed
      and previous.lineup_published,false), 'playerIds', player_ids);
end;
$$;

create function public.get_cross_team_callup_reference(checked_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('matches.lineup_edit')
    or not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permiso para comprobar esta convocatoria';
  end if;
  return public.cross_team_callup_reference_internal(checked_match_id);
end;
$$;

-- Publicación, cambios de calendario y confirmación del acta se coordinan por
-- competición, también al publicar las dos fichas de un derbi atómicamente.
create function public.lock_match_callup_competition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare competition_ids uuid[];
begin
  if tg_op = 'DELETE' then competition_ids := array[old.competition_id];
  elsif tg_op = 'INSERT' then competition_ids := array[new.competition_id];
  else competition_ids := array[old.competition_id,new.competition_id]; end if;
  perform 1 from public.season_competitions where id = any(competition_ids) order by id for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger match_callup_competition_lock before insert or update or delete on public.matches
for each row execute function public.lock_match_callup_competition();

-- AFTER ve la ficha final, incluido el cambio de equipo/competición/fecha.
-- Lanzar una excepción revierte toda la publicación, incluida la del derbi.
create function public.guard_cross_team_callup_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
declare reference jsonb;
declare repeated integer;
begin
  if not new.lineup_published or new.status in ('completed','cancelled') then return new; end if;
  if tg_op = 'UPDATE' and old.lineup_published
    and (new.team_id,new.competition_id,new.match_date,new.kickoff_time,new.status) is not distinct from
        (old.team_id,old.competition_id,old.match_date,old.kickoff_time,old.status) then return new; end if;
  reference := public.cross_team_callup_reference_internal(new.id);
  if not (reference->>'enabled')::boolean or reference->>'matchId' is null then return new; end if;
  if not (reference->>'confirmed')::boolean then
    raise exception 'Confirma el acta del último partido del otro equipo antes de publicar esta convocatoria';
  end if;
  select count(distinct lineup.player_id) into repeated from public.match_lineup lineup
  where lineup.match_id = new.id and exists (
    select 1 from jsonb_array_elements_text(reference->'playerIds') previous(player_id)
    where previous.player_id::uuid = lineup.player_id
  );
  if repeated > 7 then
    raise exception 'Hay % jugadoras de la última acta del otro equipo. Solo pueden repetirse 7', repeated;
  end if;
  return new;
end;
$$;
create trigger cross_team_callup_publication_guard after insert or update on public.matches
for each row execute function public.guard_cross_team_callup_publication();

revoke all on function public.create_season_competition(uuid,text,text,text,boolean,boolean),
  public.update_season_competition(uuid,text,text,text,boolean,boolean),
  public.get_cross_team_callup_reference(uuid) from public,anon;
grant execute on function public.create_season_competition(uuid,text,text,text,boolean,boolean),
  public.update_season_competition(uuid,text,text,text,boolean,boolean),
  public.get_cross_team_callup_reference(uuid) to authenticated;
revoke all on function public.cross_team_callup_reference_internal(uuid),
  public.lock_match_callup_competition(), public.guard_cross_team_callup_publication()
  from public,anon,authenticated;

commit;
