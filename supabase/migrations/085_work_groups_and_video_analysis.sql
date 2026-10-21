-- Ejecutar completa después de 084 en el SQL Editor de Supabase.
-- La importación inicial se limita a la temporada que cubre el 17/10/2026.
begin;

insert into public.permission_definitions
  (key,section_key,section_label,label,description,action,parent_key,sort_order,configurable,owner_only)
values
  ('work_groups.view','work_groups','Grupos de trabajo','Consultar grupos','Consulta nombres y responsabilidades de la temporada.','view',null,683,true,false),
  ('work_groups.manage','work_groups','Grupos de trabajo','Organizar integrantes','Solo el owner añade, retira, vincula y mueve integrantes.','edit','work_groups.view',684,false,true),
  ('video_analysis.view','video_analysis','Vídeo análisis','Consultar asignaciones','Consulta el grupo responsable de cada partido publicado.','view',null,685,true,false),
  ('video_analysis.manage','video_analysis','Vídeo análisis','Asignar partidos','Solo el owner organiza el reparto por partido.','edit','video_analysis.view',686,false,true);
insert into public.role_permission_defaults(role,permission_key)
select role,key from unnest(array['coach','viewer','player']) as roles(role)
cross join unnest(array['work_groups.view','video_analysis.view']) as keys(key);
insert into public.role_permissions(role,permission_key)
select role,permission_key from public.role_permission_defaults where permission_key in ('work_groups.view','video_analysis.view');

-- Un reparto pequeño por temporada; los nombres sin cuenta son integrantes válidos.
-- No se crean perfiles ni se deducen identidades por similitud de nombres.
create table public.work_group_seasons (
  season_id uuid primary key references public.seasons(id) on delete cascade,
  members jsonb not null default '[]'::jsonb check (jsonb_typeof(members) = 'array'),
  version integer not null default 0 check (version >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.video_analysis_assignments (
  match_id uuid primary key references public.matches(id) on delete cascade,
  season_id uuid not null references public.work_group_seasons(season_id) on delete cascade,
  pool_key text not null check (pool_key in ('merchan','staff','material','terceros','eventos','equipaciones','botiquin')),
  locked boolean not null default false,
  check (not locked or pool_key = 'merchan')
);
create index video_analysis_season_idx on public.video_analysis_assignments(season_id);
create unique index video_analysis_initial_derby on public.video_analysis_assignments(season_id) where locked;
alter table public.work_group_seasons enable row level security;
alter table public.video_analysis_assignments enable row level security;
revoke all on public.work_group_seasons,public.video_analysis_assignments from public,anon,authenticated;

-- Mover un encuentro a otra temporada elimina su responsabilidad anterior.
-- Los cambios de fecha dentro de la temporada conservan la asignación.
create function public.guard_video_analysis_match_season()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.season_id is distinct from old.season_id then
    delete from public.video_analysis_assignments where match_id = new.id;
  end if;
  return new;
end;
$$;
create trigger matches_guard_video_analysis_season after update of season_id on public.matches
for each row execute function public.guard_video_analysis_match_season();
revoke all on function public.guard_video_analysis_match_season() from public,anon,authenticated;

create function public.work_group_can_view(checked_season_id uuid,checked_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_permission(checked_permission) and exists (
    select 1 from public.profiles actor cross join public.seasons season
    where actor.id = (select auth.uid()) and season.id = checked_season_id
      and actor.is_approved and actor.is_active and not actor.is_archived
      and (actor.is_owner or actor.is_coach or actor.is_viewer or (actor.is_player and exists (
        select 1 from public.season_players membership
        where membership.player_id = actor.id and membership.season_id = season.id
          and membership.active_from <= greatest(season.start_date,least(season.end_date,(now() at time zone 'Europe/Madrid')::date))
          and (membership.active_until is null or membership.active_until >= greatest(season.start_date,least(season.end_date,(now() at time zone 'Europe/Madrid')::date)))
      )))
  );
$$;

create function public.work_group_candidates(checked_season_id uuid)
returns table(id uuid,display_name text) language sql stable security definer set search_path = '' as $$
  select player.id,player.display_name from public.profiles player
  join public.seasons season on season.id = checked_season_id
  where player.is_approved and player.is_active and not player.is_archived
    and (player.is_coach or (player.is_player and exists (
      select 1 from public.season_players membership
      where membership.player_id = player.id and membership.season_id = season.id
        and membership.active_from <= greatest(season.start_date,least(season.end_date,(now() at time zone 'Europe/Madrid')::date))
        and (membership.active_until is null or membership.active_until >= greatest(season.start_date,least(season.end_date,(now() at time zone 'Europe/Madrid')::date)))
    )))
  order by player.display_name,player.id;
$$;

-- La ficha local identifica el derbi: reprogramar no cambia su identidad.
-- Es un helper interno; el permiso de temporada y la vinculación por fecha
-- se comprueban antes de devolver filas desde la RPC pública.
create function public.video_analysis_matches(checked_season_id uuid)
returns table(id uuid,match_date date,kickoff_time time,title text,competition text,notes text,internal_fixture_id uuid,status text)
language sql stable security definer set search_path = '' as $$
  select selected.id,selected.match_date,selected.kickoff_time,
    case when selected.is_home then coalesce(team.name,'Unizar Femenino') || ' vs ' || selected.opponent
      else selected.opponent || ' vs ' || coalesce(team.name,'Unizar Femenino') end,
    case when selected.match_kind = 'friendly' then 'Amistoso' else coalesce(competition.name,'Competición') end,
    selected.notes,selected.internal_fixture_id,selected.status::text
  from (
    select distinct on (coalesce(match.internal_fixture_id,match.id)) match.*
    from public.matches match where match.season_id = checked_season_id and match.status in ('published','completed')
    order by coalesce(match.internal_fixture_id,match.id),match.is_home desc,match.id
  ) selected
  left join public.season_teams team on team.id = selected.team_id
  left join public.season_competitions competition on competition.id = selected.competition_id;
$$;

create function public.get_work_group_workspace(checked_season_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  workspace public.work_group_seasons;
  visible_matches jsonb := '[]'::jsonb;
  is_staff boolean;
begin
  if not (public.work_group_can_view(checked_season_id,'work_groups.view')
    or public.work_group_can_view(checked_season_id,'video_analysis.view')) then
    raise exception 'No tienes permiso para consultar estos grupos';
  end if;
  select * into workspace from public.work_group_seasons where season_id = checked_season_id;
  select actor.is_owner or actor.is_coach or actor.is_viewer into is_staff from public.profiles actor where actor.id = (select auth.uid());
  if public.current_user_has_permission('video_analysis.view') then
    select coalesce(jsonb_agg(to_jsonb(match) order by match.match_date,match.kickoff_time nulls first,match.id),'[]'::jsonb)
    into visible_matches from public.video_analysis_matches(checked_season_id) match
    where is_staff or exists (
      select 1 from public.season_players membership where membership.season_id = checked_season_id
        and membership.player_id = (select auth.uid()) and membership.active_from <= match.match_date
        and (membership.active_until is null or membership.active_until >= match.match_date)
    );
  end if;
  return jsonb_build_object('initial_derby_id',case when public.current_user_has_permission('video_analysis.view') then
      (select assignment.match_id from public.video_analysis_assignments assignment where assignment.season_id = checked_season_id and assignment.locked) else null end,
    'version',coalesce(workspace.version,0),'members',coalesce(workspace.members,'[]'::jsonb),
    'candidates',case when public.current_user_is_owner() then
      (select coalesce(jsonb_agg(to_jsonb(candidate)),'[]'::jsonb) from public.work_group_candidates(checked_season_id) candidate) else '[]'::jsonb end,
    'matches',visible_matches,
    'assignments',(select coalesce(jsonb_agg(to_jsonb(assignment) - 'season_id' order by assignment.match_id),'[]'::jsonb)
      from public.video_analysis_assignments assignment where assignment.season_id = checked_season_id
        and exists (select 1 from jsonb_array_elements(visible_matches) match where (match->>'id')::uuid = assignment.match_id)));
end;
$$;

create function public.work_group_normalized_name(checked_name text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(translate(trim(checked_name),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'),'\s+',' ','g'));
$$;

create function public.save_work_group_members(checked_season_id uuid,expected_version integer,checked_members jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare workspace public.work_group_seasons; clean_members jsonb;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('work_groups.manage') then
    raise exception 'Solo el owner puede organizar los grupos de trabajo';
  end if;
  if checked_members is null or jsonb_typeof(checked_members) <> 'array' or jsonb_array_length(checked_members) > 300 then
    raise exception 'El listado de integrantes no es válido';
  end if;
  insert into public.work_group_seasons(season_id) values(checked_season_id) on conflict do nothing;
  select * into workspace from public.work_group_seasons where season_id = checked_season_id for update;
  if workspace.version is distinct from expected_version then
    raise exception 'El reparto ha cambiado. Cierra la edición y vuelve a abrir la sección antes de guardar';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(checked_members) member(id uuid,group_key text,profile_id uuid,display_name text)
    where member.id is null or member.group_key is null or member.group_key not in ('botiquin','equipaciones','terceros','eventos','material','merchan','camara','fichas','entrenadores')
      or member.display_name is null or length(trim(member.display_name)) not between 1 and 100
      or (member.profile_id is not null
        and not exists(select 1 from public.work_group_candidates(checked_season_id) candidate where candidate.id = member.profile_id)
        and not exists(select 1 from jsonb_array_elements(workspace.members) existing where (existing->>'profile_id')::uuid = member.profile_id and (existing->>'id')::uuid = member.id))
  ) then raise exception 'Revisa los nombres, grupos y cuentas vinculadas'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',member.id,'group_key',member.group_key,'profile_id',member.profile_id,
    'display_name',coalesce(profile.display_name,trim(member.display_name))) order by member.id),'[]'::jsonb)
  into clean_members from jsonb_to_recordset(checked_members) member(id uuid,group_key text,profile_id uuid,display_name text)
  left join public.profiles profile on profile.id = member.profile_id;
  if exists(select 1 from jsonb_to_recordset(clean_members) member(id uuid) group by member.id having count(*) > 1)
    or exists(select 1 from jsonb_to_recordset(clean_members) member(profile_id uuid) where member.profile_id is not null group by member.profile_id having count(*) > 1)
    or exists(select 1 from jsonb_to_recordset(clean_members) member(display_name text) group by public.work_group_normalized_name(member.display_name) having count(*) > 1)
  then raise exception 'Cada integrante solo puede pertenecer a un grupo de trabajo'; end if;
  update public.work_group_seasons set members = clean_members,version = version + 1,updated_by = (select auth.uid()),updated_at = now()
  where season_id = checked_season_id;
end;
$$;

create function public.save_video_analysis_assignments(checked_season_id uuid,expected_version integer,checked_assignments jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare workspace public.work_group_seasons; derby_id uuid;
begin
  if not public.current_user_is_owner() or not public.current_user_has_permission('video_analysis.manage') then
    raise exception 'Solo el owner puede asignar el vídeo análisis';
  end if;
  if checked_assignments is null or jsonb_typeof(checked_assignments) <> 'array' or jsonb_array_length(checked_assignments) > 500 then
    raise exception 'El reparto de partidos no es válido';
  end if;
  insert into public.work_group_seasons(season_id) values(checked_season_id) on conflict do nothing;
  select * into workspace from public.work_group_seasons where season_id = checked_season_id for update;
  if workspace.version is distinct from expected_version then
    raise exception 'El reparto ha cambiado. Cancela la edición y vuelve a abrir la sección antes de guardar';
  end if;
  -- Bloquear también las fichas: no guardar contra un calendario modificado a la vez.
  perform 1 from public.matches where season_id = checked_season_id order by id for share;
  if exists(select 1 from jsonb_to_recordset(checked_assignments) entry(match_id uuid,pool_key text)
    where entry.match_id is null or entry.pool_key is null or entry.pool_key not in ('merchan','staff','material','terceros','eventos','equipaciones','botiquin')
      or not exists(select 1 from public.video_analysis_matches(checked_season_id) match where match.id = entry.match_id))
    or exists(select 1 from jsonb_to_recordset(checked_assignments) entry(match_id uuid) group by entry.match_id having count(*) > 1)
  then raise exception 'Revisa los partidos y sus grupos responsables'; end if;
  select assignment.match_id into derby_id from public.video_analysis_assignments assignment
  where assignment.season_id = checked_season_id and assignment.locked;
  -- Solo se fija el derbi inicial importado. Si se elimina, la reserva no
  -- se transfiere a otro encuentro ni se impone a temporadas posteriores.
  if derby_id is not null and exists(select 1 from public.video_analysis_matches(checked_season_id) match where match.id = derby_id) and not exists(select 1 from jsonb_to_recordset(checked_assignments) entry(match_id uuid,pool_key text)
    where entry.match_id = derby_id and entry.pool_key = 'merchan') then
    raise exception 'El derbi inicial debe seguir asignado a Merchan';
  end if;
  -- Los cancelados conservan su asignación para una eventual restauración.
  delete from public.video_analysis_assignments assignment where assignment.season_id = checked_season_id
    and exists(select 1 from public.video_analysis_matches(checked_season_id) match where match.id = assignment.match_id)
    and not exists(select 1 from jsonb_to_recordset(checked_assignments) entry(match_id uuid) where entry.match_id = assignment.match_id);
  insert into public.video_analysis_assignments(match_id,season_id,pool_key,locked)
  select entry.match_id,checked_season_id,entry.pool_key,coalesce(entry.match_id = derby_id,false)
  from jsonb_to_recordset(checked_assignments) entry(match_id uuid,pool_key text)
  on conflict(match_id) do update set season_id = excluded.season_id,pool_key = excluded.pool_key,locked = excluded.locked;
  update public.work_group_seasons set version = version + 1,updated_by = (select auth.uid()),updated_at = now()
  where season_id = checked_season_id;
end;
$$;

revoke all on function public.work_group_can_view(uuid,text),public.work_group_candidates(uuid),public.video_analysis_matches(uuid),public.work_group_normalized_name(text) from public,anon,authenticated;
revoke all on function public.get_work_group_workspace(uuid),public.save_work_group_members(uuid,integer,jsonb),public.save_video_analysis_assignments(uuid,integer,jsonb) from public,anon;
grant execute on function public.get_work_group_workspace(uuid),public.save_work_group_members(uuid,integer,jsonb),public.save_video_analysis_assignments(uuid,integer,jsonb) to authenticated;

-- Distribución facilitada. Solo se vinculan coincidencias exactas y únicas,
-- ignorando mayúsculas, espacios y tildes; los demás nombres se conservan.
do $$
declare
  initial_season uuid;
  initial_members jsonb;
  derby_id uuid;
  fixture record;
  chosen_pool text;
begin
  select id into initial_season from public.seasons where start_date <= date '2026-10-17' and end_date >= date '2026-10-17';
  if initial_season is null then return; end if;
  with source(group_key,names) as (values
    ('botiquin',array['Noella Esques','Sofía Pascual','Inés Serrano','Nagore Astorga','Beatriz Pacha','María Rodrigo','Ángela Rodríguez']),
    ('equipaciones',array['Alex Espinosa','Izarbe Rodríguez','María De Benito','Inés Santolaria','Jimena Corellano','Pilar Usón','Gabriela Pérez']),
    ('terceros',array['Lucía Orcos','Ainara Mur','Ainhoa Allue','Elena Pérez','Nuria Cabello','Lorena Lopez']),
    ('eventos',array['Inés Federío','Ana Lázaro','Paula Ceña','Bea Pejenaute']),
    ('material',array['Claudia Calvo','Patricia Martínez','Inés Jarauta','Inés Acero','Marta Briñas','Ana Noguero Sanz','Inés Pace','Jara Murguía Alonso']),
    ('merchan',array['Sofía Serrano','Laura Miramón','Leyre Lázaro','Nastia Moreno','Elena Valero']),
    ('camara',array['Matilde Gurrea','Nerea Andres','Zaira Díaz']),
    ('fichas',array['Inés Moreno Arjol','Ysa Sanz']),('entrenadores',array['Isabel Salinas'])
  ), people as(select source.group_key,unnest(source.names) display_name from source)
  select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'group_key',people.group_key,'display_name',people.display_name,
    'profile_id',(select case when count(*) = 1 then (array_agg(candidate.id))[1] else null end
      from public.work_group_candidates(initial_season) candidate
      where public.work_group_normalized_name(candidate.display_name) = public.work_group_normalized_name(people.display_name))))
  into initial_members from people;
  insert into public.work_group_seasons(season_id,members,version) values(initial_season,initial_members,1);
  select match.id into derby_id from public.video_analysis_matches(initial_season) match
  where match.internal_fixture_id is not null order by match.match_date,match.kickoff_time nulls first,match.id limit 1;
  if derby_id is not null then
    insert into public.video_analysis_assignments(match_id,season_id,pool_key,locked) values(derby_id,initial_season,'merchan',true);
  end if;
  for fixture in select * from public.video_analysis_matches(initial_season) order by match_date,kickoff_time nulls first,id loop
    if fixture.id = derby_id then continue; end if;
    with pools(pool_key,group_keys,priority) as (values
      ('merchan',array['merchan'],0),('staff',array['camara','fichas','entrenadores'],1),('material',array['material'],2),
      ('terceros',array['terceros'],3),('eventos',array['eventos'],4),('equipaciones',array['equipaciones'],5),('botiquin',array['botiquin'],6)
    ), loads as (
      select pools.*,(select count(*) from jsonb_array_elements(initial_members) member where member->>'group_key' = any(pools.group_keys)) size,
        (select count(*) from public.video_analysis_assignments assignment where assignment.season_id = initial_season and assignment.pool_key = pools.pool_key) assigned
      from pools
    ) select pool_key into chosen_pool from loads where size > 0
    order by (assigned = 0) desc,case when assigned = 0 then priority::numeric else (assigned + 1)::numeric / size end,size desc,priority limit 1;
    if chosen_pool is not null then
      insert into public.video_analysis_assignments(match_id,season_id,pool_key) values(fixture.id,initial_season,chosen_pool);
    end if;
  end loop;
end;
$$;

commit;
