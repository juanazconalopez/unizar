-- Ejecutar después de 071_player_licenses.sql en el SQL Editor de Supabase.
-- Separar cambios de ficha y equipo. Los nuevos inicios de temporada no copian la ficha anterior.
begin;

drop function public.set_season_player_license(uuid,uuid,text,uuid);

create function public.set_season_player_license(checked_season_id uuid,checked_player_id uuid,checked_license text)
returns integer language plpgsql security definer set search_path = '' as $$
declare old_license text; affected integer;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('seasons.licenses') then
    raise exception 'Solo el owner puede gestionar fichas';
  end if;
  if checked_license is null or checked_license not in ('none','training','regional','national') then raise exception 'Tipo de ficha no válido'; end if;
  perform 1 from public.season_players membership where membership.season_id = checked_season_id
    and membership.player_id = checked_player_id order by membership.id for update;
  if not found then raise exception 'La jugadora no pertenece a esta temporada'; end if;
  if not exists (select 1 from public.profiles where id = checked_player_id and is_player) then raise exception 'El perfil no es una jugadora'; end if;
  select license_type into old_license from public.season_player_licenses
  where season_id = checked_season_id and player_id = checked_player_id for update;
  if old_license is distinct from checked_license then
    update public.season_player_licenses set license_type = checked_license,updated_at = clock_timestamp(),updated_by = (select auth.uid())
    where season_id = checked_season_id and player_id = checked_player_id;
    insert into public.player_license_history (season_id,player_id,previous_license,license_type,changed_by,changed_at)
    values (checked_season_id,checked_player_id,old_license,checked_license,(select auth.uid()),clock_timestamp());
  end if;
  -- La ficha deportiva conserva el equipo: los movimientos se hacen en Temporadas → Equipos.
  -- Sin ficha/Entrenamientos retira únicamente el equipo actual, manteniendo periodos cerrados.
  if checked_license in ('none','training') then
    update public.season_players set season_team_id = null
    where season_id = checked_season_id and player_id = checked_player_id
      and active_until is null and season_team_id is not null;
  end if;
  select count(distinct match.id)::integer into affected from public.matches match
  join public.match_lineup lineup on lineup.match_id = match.id and lineup.player_id = checked_player_id
  where match.season_id = checked_season_id and match.status = 'published'
    and match.match_date >= (pg_catalog.now() at time zone 'Europe/Madrid')::date
    and not public.player_license_allows_match(match.id,checked_player_id);
  return affected;
end;
$$;

revoke all on function public.set_season_player_license(uuid,uuid,text) from public,anon;
grant execute on function public.set_season_player_license(uuid,uuid,text) to authenticated;

create or replace function public.create_default_season_team()
returns trigger language plpgsql security definer set search_path = '' as $$
declare default_team_id uuid;
begin
  insert into public.season_teams (season_id,name,is_default,created_by)
  values (new.id,'Unizar Femenino',true,new.created_by) returning id into default_team_id;

  -- Crear la ficha y su estado inicial antes de la vinculación con equipo: el guard exige ficha deportiva.
  insert into public.season_player_licenses (season_id,player_id,license_type,updated_by)
  select new.id,profile.id,'regional',new.created_by from public.profiles profile
  where profile.is_player and profile.is_approved and profile.is_active and not profile.is_archived;
  insert into public.player_license_history (season_id,player_id,license_type,changed_at,changed_by)
  select new.id,license.player_id,'regional',new.start_date::timestamp at time zone 'Europe/Madrid',new.created_by
  from public.season_player_licenses license where license.season_id = new.id;
  insert into public.season_players (season_id,player_id,active_from,active_until,season_team_id)
  select new.id,license.player_id,new.start_date,null,default_team_id
  from public.season_player_licenses license where license.season_id = new.id;
  return new;
end;
$$;
-- Mantener la inicialización interna: no es una operación invocable por el cliente.
revoke all on function public.create_default_season_team() from public,anon,authenticated;

commit;
