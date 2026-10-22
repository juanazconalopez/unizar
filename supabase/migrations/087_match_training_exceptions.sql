-- Ejecutar completa después de 086_training_group_individual_members.sql en Supabase web.
-- Autorizaciones por partido: no cambian la ficha ni el equipo de temporada.
begin;

insert into public.permission_definitions
  (key,section_key,section_label,label,description,action,parent_key,sort_order,configurable,owner_only)
values ('matches.training_exceptions','matches','Partidos','Añadir jugadoras de solo entrenamientos',
  'Owner y entrenadores autorizan participaciones excepcionales para un partido concreto.','edit',
  'matches.availability_edit',349,true,false);
insert into public.role_permission_defaults (role,permission_key) values ('coach','matches.training_exceptions');
insert into public.role_permissions (role,permission_key) values ('coach','matches.training_exceptions');

create table public.match_training_exceptions (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  authorized_by uuid not null references public.profiles(id),
  authorized_at timestamptz not null default clock_timestamp(),
  reason text not null check (length(trim(reason)) between 1 and 500),
  primary key (match_id,player_id)
);
alter table public.match_training_exceptions enable row level security;
-- Los clientes solo reciben los identificadores deportivos de partidos que ya pueden consultar.
revoke all on public.match_training_exceptions from public,anon,authenticated;
grant select (match_id,player_id) on public.match_training_exceptions to authenticated;
create policy "Match viewers read training authorizations" on public.match_training_exceptions
for select to authenticated using (public.current_user_has_permission('matches.view')
  and exists (select 1 from public.matches match where match.id = match_id));

create function public.player_has_match_training_exception(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.match_training_exceptions exception_entry
    where exception_entry.match_id = checked_match_id and exception_entry.player_id = checked_player_id);
$$;
revoke all on function public.player_has_match_training_exception(uuid,uuid) from public,anon,authenticated;


create or replace function public.player_license_allows_match(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches match
    join public.season_player_licenses license on license.season_id = match.season_id and license.player_id = checked_player_id
    left join public.season_competitions competition on competition.id = match.competition_id
    cross join lateral (
      select case when match.status <> 'completed' and match.match_date >= (pg_catalog.now() at time zone 'Europe/Madrid')::date
        then license.license_type
        else coalesce((select history.license_type from public.player_license_history history
          where history.season_id = match.season_id and history.player_id = checked_player_id
            and history.changed_at <= least((match.match_date + coalesce(match.kickoff_time, time '23:59:59')) at time zone 'Europe/Madrid',
              coalesce(match.completed_at,'infinity'::timestamptz))
          order by history.changed_at desc,history.id desc limit 1),'none') end as license_type
    ) effective
    where match.id = checked_match_id and exists (
      select 1 from public.season_players membership where membership.season_id = match.season_id
        and membership.player_id = checked_player_id and membership.active_from <= match.match_date
        and (membership.active_until is null or membership.active_until >= match.match_date)
    ) and (match.match_kind = 'friendly' or (
      (effective.license_type in ('regional','national') or (effective.license_type = 'training'
        and public.player_has_match_training_exception(checked_match_id,checked_player_id)))
      and (competition.competition_level = 'regional' or effective.license_type = 'national'
        or (effective.license_type = 'training' and public.player_has_match_training_exception(checked_match_id,checked_player_id)))
      and (competition.competition_level <> 'regional'
        or public.national_league_starts(match.season_id,checked_player_id,match.id) < 6)
    ))
  );
$$;

create or replace function public.player_license_allows_availability(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches match
    join public.season_player_licenses license on license.season_id = match.season_id and license.player_id = checked_player_id
    cross join lateral (
      select case when match.status <> 'completed' and match.match_date >= (pg_catalog.now() at time zone 'Europe/Madrid')::date
        then license.license_type
        else coalesce((select history.license_type from public.player_license_history history
          where history.season_id = match.season_id and history.player_id = checked_player_id
            and history.changed_at <= least((match.match_date + coalesce(match.kickoff_time, time '23:59:59')) at time zone 'Europe/Madrid',
              coalesce(match.completed_at,'infinity'::timestamptz))
          order by history.changed_at desc,history.id desc limit 1),'none') end as license_type
    ) effective
    where match.id = checked_match_id
      and (effective.license_type in ('regional','national') or (effective.license_type = 'training'
        and public.player_has_match_training_exception(checked_match_id,checked_player_id)))
      and public.player_license_allows_match(checked_match_id,checked_player_id)
  );
$$;


-- Solo la RPC puede incorporar una participación real a un acta ya cerrada.
-- El contexto está limitado a una jugadora y ficha; no abre la disponibilidad general.
create function public.is_historical_training_exception_write(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select current_setting('app.training_exception_write',true) = checked_match_id::text || ':' || checked_player_id::text
    and public.current_user_has_permission('matches.training_exceptions')
    and public.current_user_can_edit_match(checked_match_id)
    and public.player_has_match_training_exception(checked_match_id,checked_player_id)
    and exists (select 1 from public.matches match where match.id = checked_match_id
      and match.status in ('published','completed') and match.lineup_published
      and match.match_date <= (now() at time zone 'Europe/Madrid')::date)
    and exists (select 1 from public.profiles actor where actor.id = (select auth.uid())
      and actor.is_approved and actor.is_active and not actor.is_archived and (actor.is_owner or actor.is_coach));
$$;
revoke all on function public.is_historical_training_exception_write(uuid,uuid) from public,anon,authenticated;


create or replace function public.guard_match_player_license()
returns trigger language plpgsql security definer set search_path = '' as $$
declare checked_match public.matches%rowtype;
begin
  select * into checked_match from public.matches where id = new.match_id;
  if tg_table_name = 'match_availability' then
    if checked_match.status <> 'published' and not (new.status = 'available'
      and coalesce(public.is_historical_training_exception_write(new.match_id,new.player_id),false)) then
      raise exception 'El partido no está abierto para registrar disponibilidad';
    end if;
  end if;
  perform 1 from public.season_players membership where membership.season_id = checked_match.season_id
    and membership.player_id = new.player_id order by membership.id for share;
  -- Ver un partido de otro equipo no equivale a poder responder o jugarlo.
  if tg_table_name = 'match_availability' then
    if not public.player_can_access_match(new.match_id,new.player_id)
      or not exists (select 1 from public.season_player_licenses license
        where license.season_id = checked_match.season_id and license.player_id = new.player_id
          and (license.license_type in ('regional','national') or (license.license_type = 'training'
            and public.player_has_match_training_exception(new.match_id,new.player_id))))
      or not public.player_license_allows_availability(new.match_id,new.player_id) then
      raise exception 'Para responder disponibilidad necesitas ficha Regional o Nacional válida para este partido';
    end if;
    if public.player_has_absence_on(new.player_id,checked_match.match_date) then
      raise exception 'La jugadora está de baja en esta fecha';
    end if;
    if checked_match.internal_fixture_id is not null and exists (
      select 1 from public.matches paired
      join public.match_lineup other_lineup on other_lineup.match_id = paired.id
      where paired.internal_fixture_id = checked_match.internal_fixture_id and paired.id <> checked_match.id
        and paired.lineup_published and other_lineup.player_id = new.player_id
    ) then raise exception 'La jugadora ya está convocada en el otro equipo del derbi'; end if;
  -- Los resultados pasados pueden corregirse sin aplicar la ficha actual.
  elsif checked_match.status <> 'completed' and not public.player_license_allows_match(new.match_id,new.player_id) then
    raise exception 'La ficha de la jugadora no permite participar en este partido';
  end if;
  return new;
end;
$$;

create or replace function public.guard_match_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare fixture_id uuid;
begin
  -- El orden de respuestas procede del servidor, también en inserciones directas.
  new.updated_at := pg_catalog.clock_timestamp();
  select internal_fixture_id into fixture_id from public.matches where id = new.match_id;
  perform 1 from public.matches related
    where related.id = new.match_id or (fixture_id is not null and related.internal_fixture_id = fixture_id)
    order by related.id for update;
  if new.status = 'available' and coalesce(public.is_historical_training_exception_write(new.match_id,new.player_id),false) then
    return new;
  end if;
  if exists (select 1 from public.matches related
    where (related.id = new.match_id or (fixture_id is not null and related.internal_fixture_id = fixture_id))
      and related.lineup_published) then
    raise exception 'La disponibilidad está cerrada porque la convocatoria ya está publicada';
  end if;
  if new.status <> 'available'::public.availability_status then
    delete from public.match_lineup lineup using public.matches related
    where lineup.match_id = related.id and lineup.player_id = new.player_id
      and (related.id = new.match_id or (fixture_id is not null and related.internal_fixture_id = fixture_id));
  end if;
  return new;
end;
$$;

create or replace function public.save_match_lineup(checked_match_id uuid, lineup_entries jsonb, publish_lineup boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare maximum_slots integer;
declare starter_slots integer;
declare was_published boolean;
declare checked_date date;
declare fixture_id uuid;
declare locked_window date;
begin
  if not public.current_user_can_edit_match(checked_match_id) or not public.current_user_has_permission('matches.lineup_edit') then
    raise exception 'No tienes permiso para gestionar esta convocatoria';
  end if;
  select case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end, lineup_published, match_date, internal_fixture_id
  into maximum_slots, starter_slots, was_published, checked_date, fixture_id
  from public.matches where id = checked_match_id;
  if not found then raise exception 'El partido no existe'; end if;
  locked_window := public.match_participation_window(checked_date);
  perform public.lock_match_participation_window(checked_date);
  select case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end, lineup_published, match_date, internal_fixture_id
  into maximum_slots, starter_slots, was_published, checked_date, fixture_id
  from public.matches where id = checked_match_id for update;
  if not found then raise exception 'El partido no existe'; end if;
  if public.match_participation_window(checked_date) <> locked_window then
    raise exception 'La fecha del partido ha cambiado. Vuelve a abrir la convocatoria';
  end if;
  if was_published then raise exception 'La convocatoria publicada ya no se puede modificar'; end if;
  if fixture_id is not null and publish_lineup then raise exception 'El owner debe publicar juntas las dos convocatorias'; end if;
  if fixture_id is null and publish_lineup and not public.current_user_has_permission('matches.lineup_publish') then
    raise exception 'No tienes permiso para publicar convocatorias';
  end if;
  if jsonb_typeof(lineup_entries) is distinct from 'array' then raise exception 'La convocatoria debe ser una lista'; end if;
  if exists (select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    where coalesce((entry->>'slot_number')::smallint, 0) not between 1 and maximum_slots) then
    raise exception 'El dorsal no es válido para este tipo de partido';
  end if;
  if exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    join public.matches match on match.id = checked_match_id
    left join public.season_players membership on membership.season_id = match.season_id
      and membership.player_id = (entry->>'player_id')::uuid
      and membership.active_from <= match.match_date
      and (membership.active_until is null or membership.active_until >= match.match_date)
    left join public.profiles player on player.id = (entry->>'player_id')::uuid
    left join lateral public.match_fixture_availability(checked_match_id) availability on availability.match_id = checked_match_id
      and availability.player_id = (entry->>'player_id')::uuid and availability.status = 'available'::public.availability_status
    where membership.id is null or player.id is null or availability.player_id is null
      or not player.is_approved or not player.is_active or player.is_archived or not player.is_player
      or public.player_has_absence_on((entry->>'player_id')::uuid, match.match_date)
  ) then raise exception 'La convocatoria contiene una jugadora que no está disponible'; end if;
  if not public.current_user_is_owner() and exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    join public.matches match on match.id = checked_match_id
    join public.season_players membership on membership.season_id = match.season_id
      and membership.player_id = (entry->>'player_id')::uuid
      and membership.active_from <= match.match_date
      and (membership.active_until is null or membership.active_until >= match.match_date)
    left join public.season_teams team on team.id = membership.season_team_id
    where not (membership.season_team_id is null and (match.match_kind = 'friendly'
      or public.player_has_match_training_exception(checked_match_id,(entry->>'player_id')::uuid)))
      and membership.season_team_id is distinct from match.team_id and coalesce(team.is_mixed, false) = false
  ) then raise exception 'Solo el owner puede incorporar jugadoras de otro equipo'; end if;
  if exists (
    select 1 from jsonb_array_elements(lineup_entries) entries(entry)
    join public.matches other_match on other_match.id <> checked_match_id
    cross join lateral public.match_participation_player_ids(other_match.id) other_lineup
    where other_lineup.player_id = (entry->>'player_id')::uuid
      and other_match.status <> 'cancelled'
      and public.match_participation_window(other_match.match_date) = public.match_participation_window(checked_date)
      and (fixture_id is null or other_match.internal_fixture_id is distinct from fixture_id)
  ) then raise exception 'Una jugadora ya está reservada en la convocatoria de otro partido del mismo fin de semana o día'; end if;
  delete from public.match_lineup where match_id = checked_match_id;
  insert into public.match_lineup (match_id, player_id, role, position, slot_number, sort_order)
  select checked_match_id, (entry->>'player_id')::uuid,
    case when (entry->>'slot_number')::smallint <= starter_slots then 'starter'::public.lineup_role else 'substitute'::public.lineup_role end,
    null, (entry->>'slot_number')::smallint, (entry->>'slot_number')::smallint
  from jsonb_array_elements(lineup_entries) entries(entry);
  if fixture_id is null then
    update public.matches set lineup_published = publish_lineup where id = checked_match_id;
  end if;
end;
$$;


create or replace function public.player_availability_opportunities(checked_season_id uuid, checked_player_id uuid)
returns table(match_id uuid, window_start date, availability_status public.availability_status)
language sql stable security definer set search_path = '' as $$
  select distinct on (public.match_participation_window(match.match_date))
    match.id, public.match_participation_window(match.match_date), response.status
  from public.matches match
  join public.season_players membership on membership.season_id = match.season_id
    and membership.player_id = checked_player_id
    and match.match_date >= membership.active_from
    and (membership.active_until is null or match.match_date <= membership.active_until)
  left join public.season_teams team on team.id = membership.season_team_id
  left join public.match_lineup lineup on lineup.match_id = match.id and lineup.player_id = checked_player_id
  left join lateral public.match_fixture_availability(match.id) response on response.player_id = checked_player_id
  where match.season_id = checked_season_id
    and match.status in ('published'::public.match_status, 'completed'::public.match_status)
    and public.player_license_allows_availability(match.id, checked_player_id)
    and (membership.season_team_id = match.team_id or coalesce(team.is_mixed, false)
      or lineup.player_id is not null
      or public.player_has_match_training_exception(match.id,checked_player_id)
      or (match.match_kind = 'friendly' and membership.season_team_id is null and match.team_id is null))
  order by public.match_participation_window(match.match_date),
    (lineup.player_id is not null) desc,
    coalesce(membership.season_team_id = match.team_id, false) desc,
    (response.status is not null) desc,
    match.match_date, match.kickoff_time nulls last, match.is_home desc, match.id;
$$;

create function public.add_match_training_player(
  checked_match_id uuid, checked_player_id uuid, checked_reason text, checked_slot_number integer default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.matches%rowtype;
  checked_date date;
  locked_window date;
  historical boolean;
  starters integer;
  maximum_slots integer;
  normalized_reason text := coalesce(nullif(trim(checked_reason),''),'Participación excepcional autorizada por el staff.');
begin
  if not public.current_user_has_permission('matches.training_exceptions')
    or not public.current_user_can_edit_match(checked_match_id)
    or not exists (select 1 from public.profiles actor where actor.id = (select auth.uid())
      and actor.is_approved and actor.is_active and not actor.is_archived and (actor.is_owner or actor.is_coach)) then
    raise exception 'Solo el owner o los entrenadores autorizados pueden añadir jugadoras de solo entrenamientos';
  end if;
  if length(normalized_reason) > 500 then raise exception 'El motivo no puede superar los 500 caracteres'; end if;
  select match_date into checked_date from public.matches where id = checked_match_id;
  if not found then raise exception 'El partido no existe'; end if;
  locked_window := public.match_participation_window(checked_date);
  perform public.lock_match_participation_window(checked_date);
  -- Mismo orden que guardado y publicación: periodo, fichas y vinculaciones.
  perform 1 from public.matches related
    where related.id = checked_match_id or related.internal_fixture_id = (
      select internal_fixture_id from public.matches where id = checked_match_id)
    order by related.id for update;
  select * into target from public.matches where id = checked_match_id;
  if not found or public.match_participation_window(target.match_date) <> locked_window then
    raise exception 'La fecha del partido ha cambiado. Vuelve a abrir Disponibilidad';
  end if;
  if target.status not in ('published','completed') then raise exception 'Publica el partido antes de añadir jugadoras'; end if;
  if not public.current_user_can_edit_match(checked_match_id) then raise exception 'El equipo del partido ha cambiado'; end if;
  perform 1 from public.season_players where season_id = target.season_id and player_id = checked_player_id order by id for share;
  perform 1 from public.season_player_licenses where season_id = target.season_id and player_id = checked_player_id for share;
  perform 1 from public.profiles where id = checked_player_id for share;
  if not exists (select 1 from public.profiles player
    join public.season_player_licenses license on license.player_id = player.id and license.season_id = target.season_id
    join public.season_players membership on membership.player_id = player.id and membership.season_id = target.season_id
    where player.id = checked_player_id and player.is_player and player.is_approved and player.is_active and not player.is_archived
      and license.license_type = 'training' and membership.season_team_id is null
      and membership.active_from <= target.match_date and (membership.active_until is null or membership.active_until >= target.match_date)) then
    raise exception 'Selecciona una jugadora activa con ficha Solo entrenamientos vinculada en la fecha del partido';
  end if;
  if public.player_has_absence_on(checked_player_id,target.match_date) then raise exception 'La jugadora está de baja en esta fecha'; end if;
  if exists (select 1 from public.matches other_match
    cross join lateral public.match_participation_player_ids(other_match.id) reserved
    where other_match.id <> target.id and other_match.status <> 'cancelled' and reserved.player_id = checked_player_id
      and public.match_participation_window(other_match.match_date) = locked_window) then
    raise exception 'La jugadora ya está convocada en otro partido o en el otro equipo del derbi';
  end if;
  historical := target.lineup_published and target.match_date <= (now() at time zone 'Europe/Madrid')::date;
  if target.status = 'completed' and not historical then raise exception 'Revisa la convocatoria publicada del partido finalizado'; end if;
  if not historical and exists (select 1 from public.matches related
    where (related.id = target.id or (target.internal_fixture_id is not null and related.internal_fixture_id = target.internal_fixture_id))
      and related.lineup_published) then raise exception 'Desbloquea primero la convocatoria para añadir jugadoras'; end if;
  if historical then
    if not public.current_user_has_permission('matches.lineup_edit') then raise exception 'No tienes permiso para corregir la convocatoria'; end if;
    maximum_slots := case when target.match_kind = 'official' then 23 when target.rugby_format = 'sevens' then 7 else 15 end;
    if checked_slot_number is null or checked_slot_number not between 1 and maximum_slots then raise exception 'Indica el dorsal con el que participó'; end if;
    if exists (select 1 from public.match_lineup where match_id = target.id
      and (player_id = checked_player_id or slot_number = checked_slot_number)) then
      raise exception 'La jugadora ya está convocada o el dorsal está ocupado. Revisa la convocatoria';
    end if;
  elsif checked_slot_number is not null then raise exception 'El dorsal se asigna al preparar la convocatoria'; end if;
  insert into public.match_training_exceptions (match_id,player_id,authorized_by,reason)
    values (target.id,checked_player_id,(select auth.uid()),normalized_reason) on conflict do nothing;
  if not public.player_license_allows_match(target.id,checked_player_id) then
    raise exception 'La autorización no permite participar: revisa la ficha histórica y el límite de titularidades nacionales';
  end if;
  if historical then
    perform set_config('app.training_exception_write',target.id::text || ':' || checked_player_id::text,true);
  end if;
  insert into public.match_availability (match_id,player_id,status,comment)
    values (target.id,checked_player_id,'available',null)
    on conflict (match_id,player_id) do update set status = excluded.status;
  insert into public.match_availability_coach_changes (match_id,player_id,changed_by,status,comment)
    values (target.id,checked_player_id,(select auth.uid()),'available',normalized_reason);
  if historical then
    starters := case when target.rugby_format = 'sevens' then 7 else 15 end;
    insert into public.match_lineup (match_id,player_id,role,position,slot_number,sort_order)
      values (target.id,checked_player_id,case when checked_slot_number <= starters then 'starter'::public.lineup_role else 'substitute'::public.lineup_role end,
        null,checked_slot_number,checked_slot_number);
    -- El trigger de convocatoria invalida la revisión y conserva marcador y eventos.
  end if;
  perform set_config('app.training_exception_write','',true);
end;
$$;
revoke all on function public.add_match_training_player(uuid,uuid,text,integer) from public,anon;
grant execute on function public.add_match_training_player(uuid,uuid,text,integer) to authenticated;
commit;
