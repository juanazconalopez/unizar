-- Grupos Rojo/Blanco: borrador privado, publicación manual y renovación orientativa a los 21 días.
-- Ejecutar completa después de 081 en el SQL Editor de Supabase.
begin;

insert into public.permission_definitions
  (key,section_key,section_label,label,description,action,parent_key,sort_order,configurable,owner_only)
values
  ('training_groups.view','training_groups','Grupos de entrenamiento','Consultar grupos publicados','Consulta los grupos Rojo y Blanco de la temporada.','view',null,680,true,false),
  ('training_groups.manage','training_groups','Grupos de entrenamiento','Preparar grupos','Owner y entrenadores preparan, ajustan y guardan borradores.','edit','training_groups.view',681,true,false),
  ('training_groups.publish','training_groups','Grupos de entrenamiento','Publicar grupos','Publica el reparto revisado y avisa a las jugadoras.','publish','training_groups.manage',682,true,false);
insert into public.role_permission_defaults (role,permission_key) values
  ('coach','training_groups.view'),('coach','training_groups.manage'),('coach','training_groups.publish'),
  ('viewer','training_groups.view'),('player','training_groups.view');
insert into public.role_permissions (role,permission_key)
select role,permission_key from public.role_permission_defaults where permission_key like 'training_groups.%';

create table public.training_group_blocks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  starts_on date not null,
  status text not null default 'draft' check (status in ('draft','published')),
  draft_members jsonb default '[]'::jsonb check (draft_members is null or jsonb_typeof(draft_members) = 'array'),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  check ((status = 'draft' and published_at is null and draft_members is not null)
    or (status = 'published' and published_at is not null)),
  unique (season_id,starts_on)
);
create unique index training_group_one_new_draft on public.training_group_blocks(season_id) where status = 'draft';
create index training_group_blocks_published on public.training_group_blocks(season_id,starts_on desc) where status = 'published';
create table public.training_group_members (
  block_id uuid not null references public.training_group_blocks(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  color text not null check (color in ('red','white')),
  team_id uuid, -- Instantánea histórica: no depende de que el equipo siga existiendo.
  team_name text not null,
  position_group text not null check (position_group in ('forwards','backs','unassigned')),
  notified_at timestamptz not null default now(),
  primary key (block_id,player_id)
);
create index training_group_members_player on public.training_group_members(player_id,block_id);
-- Solo se accede mediante RPC: ninguna columna de un borrador llega a las jugadoras.
alter table public.training_group_blocks enable row level security;
alter table public.training_group_members enable row level security;
revoke all on public.training_group_blocks,public.training_group_members from public,anon,authenticated;

create function public.training_group_can_manage()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_permission('training_groups.manage') and exists (
    select 1 from public.profiles actor where actor.id = (select auth.uid()) and (actor.is_owner or actor.is_coach)
      and actor.is_approved and actor.is_active and not actor.is_archived
  );
$$;
create function public.training_group_can_view(checked_season_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_permission('training_groups.view') and exists (
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
create function public.training_group_roster(checked_season_id uuid,roster_date date)
returns table(player_id uuid,display_name text,team_id uuid,team_name text,position_group text)
language sql stable security definer set search_path = '' as $$
  select distinct on (player.id) player.id,player.display_name,
    case when license.license_type = 'training' then null else team.id end,
    case when license.license_type = 'training' then 'Solo entrenamientos' else team.name end,
    case when player.primary_position in ('prop','hooker','second_row','back_row') then 'forwards'
      when player.primary_position in ('scrum_half','fly_half','centre','wing','fullback') then 'backs' else 'unassigned' end
  from public.profiles player
  join public.season_players membership on membership.player_id = player.id and membership.season_id = checked_season_id
  join public.seasons season on season.id = membership.season_id
  join public.season_player_licenses license on license.season_id = membership.season_id and license.player_id = player.id
  left join public.season_teams team on team.id = membership.season_team_id and team.season_id = membership.season_id
  where player.is_player and player.is_approved and player.is_active and not player.is_archived
    and roster_date between season.start_date and season.end_date
    and membership.active_from <= roster_date and (membership.active_until is null or membership.active_until >= roster_date)
    and (license.license_type = 'training' or (license.license_type in ('regional','national') and team.id is not null))
  order by player.id,membership.active_from desc,membership.created_at desc,membership.id desc;
  -- Las bajas deportivas no excluyen a nadie. Sin ficha nunca entra en el reparto.
$$;
revoke all on function public.training_group_can_manage(),public.training_group_can_view(uuid),public.training_group_roster(uuid,date) from public,anon,authenticated;

create function public.get_training_group_summary(checked_season_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  can_manage boolean := public.training_group_can_manage();
  today date := (now() at time zone 'Europe/Madrid')::date;
  current_id uuid;
  next_id uuid;
  season_end date;
begin
  if not public.training_group_can_view(checked_season_id) then raise exception 'No tienes permiso para consultar estos grupos'; end if;
  select end_date into season_end from public.seasons where id = checked_season_id;
  select id into current_id from public.training_group_blocks
    where season_id = checked_season_id and status = 'published' and starts_on <= today order by starts_on desc limit 1;
  select id into next_id from public.training_group_blocks
    where season_id = checked_season_id and status = 'published' and starts_on > today order by starts_on limit 1;
  return jsonb_build_object(
    'blocks',coalesce((select jsonb_agg(jsonb_build_object(
      'id',block.id,'season_id',block.season_id,'starts_on',block.starts_on,'status',block.status,
      'created_at',block.created_at,'published_at',block.published_at,'version',block.version,
      'has_draft',can_manage and block.draft_members is not null) order by block.starts_on desc)
      from public.training_group_blocks block where block.season_id = checked_season_id and (block.status = 'published' or can_manage)),'[]'::jsonb),
    'own_groups',coalesce((select jsonb_agg(jsonb_build_object(
      'block_id',block.id,'starts_on',block.starts_on,'color',member.color,'notified_at',member.notified_at) order by block.starts_on)
      from public.training_group_blocks block join public.training_group_members member on member.block_id = block.id
      where block.id in (current_id,next_id) and member.player_id = (select auth.uid())
        and today <= season_end and exists (select 1 from public.training_group_roster(checked_season_id,greatest(block.starts_on,today)) eligible where eligible.player_id = member.player_id)),'[]'::jsonb)
  );
end;
$$;

create function public.get_training_group_workspace(checked_season_id uuid,checked_block_id uuid default null,roster_date date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  can_manage boolean := public.training_group_can_manage();
  block public.training_group_blocks;
  effective_date date;
  today date := (now() at time zone 'Europe/Madrid')::date;
  season public.seasons;
  is_historical boolean;
begin
  if not public.training_group_can_view(checked_season_id) then raise exception 'No tienes permiso para consultar estos grupos'; end if;
  select * into season from public.seasons where id = checked_season_id;
  if checked_block_id is not null then
    select * into block from public.training_group_blocks where id = checked_block_id and season_id = checked_season_id and (status = 'published' or can_manage);
    if not found then raise exception 'No se ha encontrado el reparto'; end if;
  else
    select * into block from public.training_group_blocks where season_id = checked_season_id and status = 'published' and starts_on <= today order by starts_on desc limit 1;
  end if;
  effective_date := coalesce(roster_date,block.starts_on,greatest(season.start_date,least(today,season.end_date)));
  if checked_block_id is not null and block.status = 'published' then effective_date := greatest(block.starts_on,least(today,season.end_date)); end if;
  if effective_date not between season.start_date and season.end_date then raise exception 'La fecha debe estar dentro de la temporada'; end if;
  is_historical := block.status = 'published' and (season.end_date < today or exists (
    select 1 from public.training_group_blocks newer where newer.season_id = checked_season_id and newer.status = 'published'
      and newer.starts_on > block.starts_on and newer.starts_on <= today
  ));
  return jsonb_build_object(
    'candidates',case when can_manage then coalesce((select jsonb_agg(to_jsonb(eligible) order by eligible.display_name) from public.training_group_roster(checked_season_id,effective_date) eligible),'[]'::jsonb) else '[]'::jsonb end,
    'members',coalesce((select jsonb_agg(jsonb_build_object('player_id',member.player_id,'display_name',player.display_name,'color',member.color,
      'team_id',member.team_id,'team_name',member.team_name,'position_group',member.position_group) order by player.display_name)
      from public.training_group_members member join public.profiles player on player.id = member.player_id
      where member.block_id = block.id and (is_historical or exists (
        select 1 from public.training_group_roster(checked_season_id,effective_date) eligible where eligible.player_id = member.player_id
      ))),'[]'::jsonb),
    'draft',case when can_manage and checked_block_id is not null then block.draft_members else null end
  );
end;
$$;

create function public.save_training_group_draft(checked_season_id uuid,starts_on date,members jsonb,checked_block_id uuid default null,expected_version integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  block public.training_group_blocks;
  season public.seasons;
  canonical jsonb;
  effective_date date;
  today date := (now() at time zone 'Europe/Madrid')::date;
begin
  if not public.training_group_can_manage() then raise exception 'No tienes permiso para preparar grupos'; end if;
  select * into season from public.seasons where id = checked_season_id for update;
  if not found or starts_on is null or starts_on not between season.start_date and season.end_date or season.end_date < today then raise exception 'La fecha debe estar dentro de una temporada vigente o futura'; end if;
  if checked_block_id is not null then
    select * into block from public.training_group_blocks where id = checked_block_id and season_id = checked_season_id for update;
    if not found then raise exception 'No se ha encontrado el reparto'; end if;
    if expected_version is distinct from block.version then raise exception 'Otro entrenador ha modificado el reparto. Recarga para revisar sus cambios'; end if;
    if block.status = 'published' and block.starts_on <> starts_on then raise exception 'No se puede cambiar la fecha de un reparto publicado'; end if;
    if block.status = 'published' and exists (select 1 from public.training_group_blocks newer where newer.season_id = checked_season_id and newer.status = 'published' and newer.starts_on > block.starts_on and newer.starts_on <= today) then raise exception 'El reparto es histórico y no se puede modificar'; end if;
  end if;
  if (checked_block_id is null or block.status = 'draft') and starts_on < today then raise exception 'El nuevo reparto debe empezar hoy o en una fecha futura'; end if;
  if members is null or jsonb_typeof(members) <> 'array' then raise exception 'El reparto debe ser una lista de jugadoras'; end if;
  if jsonb_array_length(members) = 0 or jsonb_array_length(members) > 2000 then raise exception 'El reparto no tiene un número válido de jugadoras'; end if;
  if exists (select 1 from jsonb_array_elements(members) entry where jsonb_typeof(entry) <> 'object' or entry->>'player_id' is null or coalesce(entry->>'color','') not in ('red','white')) then raise exception 'Hay asignaciones incompletas o colores no válidos'; end if;
  if (select count(distinct (entry->>'player_id')::uuid) from jsonb_array_elements(members) entry) <> jsonb_array_length(members) then raise exception 'Una jugadora no puede estar en los dos grupos'; end if;
  effective_date := greatest(starts_on,today);
  if exists (select 1 from jsonb_array_elements(members) entry where not exists (
    select 1 from public.training_group_roster(checked_season_id,effective_date) eligible where eligible.player_id = (entry->>'player_id')::uuid
  )) then raise exception 'La plantilla ha cambiado. Actualiza las jugadoras elegibles antes de guardar'; end if;
  select jsonb_agg(jsonb_build_object('player_id',(entry->>'player_id')::uuid,'color',entry->>'color')) into canonical from jsonb_array_elements(members) entry;
  if checked_block_id is null then
    if exists (select 1 from public.training_group_blocks other where other.season_id = checked_season_id and other.status = 'draft') then raise exception 'Ya hay un borrador pendiente. Revísalo antes de generar otro'; end if;
    if exists (select 1 from public.training_group_blocks other where other.season_id = checked_season_id and other.starts_on = save_training_group_draft.starts_on) then raise exception 'Ya existe un reparto para esa fecha'; end if;
    insert into public.training_group_blocks(season_id,starts_on,draft_members,created_by)
      values(checked_season_id,starts_on,canonical,(select auth.uid())) returning id into checked_block_id;
  else
    update public.training_group_blocks set starts_on = save_training_group_draft.starts_on,draft_members = canonical,version = version + 1 where id = checked_block_id;
  end if;
  return checked_block_id;
end;
$$;

create function public.publish_training_group_block(checked_block_id uuid,expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  block public.training_group_blocks;
  season public.seasons;
  effective_date date;
  today date := (now() at time zone 'Europe/Madrid')::date;
  publication_time timestamptz := clock_timestamp();
begin
  if not public.training_group_can_manage() or not public.current_user_has_permission('training_groups.publish') then raise exception 'No tienes permiso para publicar grupos'; end if;
  select season_row.* into season from public.seasons season_row join public.training_group_blocks target on target.season_id = season_row.id where target.id = checked_block_id for update of season_row;
  select * into block from public.training_group_blocks where id = checked_block_id for update;
  if not found then raise exception 'No se ha encontrado el reparto'; end if;
  if expected_version is distinct from block.version then raise exception 'Otro entrenador ha modificado el reparto. Recarga para revisar sus cambios'; end if;
  if block.draft_members is null then raise exception 'No hay un borrador pendiente de publicar'; end if;
  if season.end_date < today or block.starts_on not between season.start_date and season.end_date or (block.status = 'draft' and block.starts_on < today) then raise exception 'Revisa la fecha de inicio del reparto'; end if;
  if exists (select 1 from public.training_group_blocks newer where newer.season_id = block.season_id and newer.status = 'published' and newer.starts_on > block.starts_on and newer.starts_on <= today) then raise exception 'El reparto es histórico y no se puede modificar'; end if;
  effective_date := greatest(block.starts_on,today);
  -- Igualdad de conjuntos: ni omitidas, ni duplicadas, ni perfiles sin ficha.
  if jsonb_array_length(block.draft_members) = 0 or exists (
    (select eligible.player_id from public.training_group_roster(block.season_id,effective_date) eligible
      except select (entry->>'player_id')::uuid from jsonb_array_elements(block.draft_members) entry)
    union all
    (select (entry->>'player_id')::uuid from jsonb_array_elements(block.draft_members) entry
      except select eligible.player_id from public.training_group_roster(block.season_id,effective_date) eligible)
  ) then raise exception 'La plantilla ha cambiado. Actualiza el borrador antes de publicar'; end if;
  delete from public.training_group_members member where member.block_id = block.id
    and not exists (select 1 from jsonb_array_elements(block.draft_members) entry where (entry->>'player_id')::uuid = member.player_id);
  insert into public.training_group_members(block_id,player_id,color,team_id,team_name,position_group,notified_at)
    select block.id,eligible.player_id,entry->>'color',eligible.team_id,eligible.team_name,eligible.position_group,publication_time
    from jsonb_array_elements(block.draft_members) entry join public.training_group_roster(block.season_id,effective_date) eligible on eligible.player_id = (entry->>'player_id')::uuid
    on conflict (block_id,player_id) do update set color = excluded.color,team_id = excluded.team_id,team_name = excluded.team_name,position_group = excluded.position_group,
      notified_at = case when public.training_group_members.color is distinct from excluded.color then excluded.notified_at else public.training_group_members.notified_at end;
  update public.training_group_blocks set status = 'published',published_at = publication_time,published_by = (select auth.uid()),draft_members = null,version = version + 1 where id = block.id;
end;
$$;

create function public.discard_training_group_draft(checked_block_id uuid,expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare block public.training_group_blocks;
begin
  if not public.training_group_can_manage() then raise exception 'No tienes permiso para preparar grupos'; end if;
  perform 1 from public.seasons season join public.training_group_blocks target on target.season_id = season.id where target.id = checked_block_id for update of season;
  select * into block from public.training_group_blocks where id = checked_block_id for update;
  if not found then raise exception 'No se ha encontrado el reparto'; end if;
  if expected_version is distinct from block.version then raise exception 'Otro entrenador ha modificado el reparto. Recarga para revisar sus cambios'; end if;
  if block.status = 'draft' then delete from public.training_group_blocks where id = block.id;
  else update public.training_group_blocks set draft_members = null,version = version + 1 where id = block.id;
  end if;
end;
$$;

-- Impide recortar una temporada dejando sus grupos fuera de fechas.
create function public.guard_training_group_season_dates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.training_group_blocks block where block.season_id = new.id and block.starts_on not between new.start_date and new.end_date) then
    raise exception 'Hay grupos de entrenamiento fuera de las nuevas fechas de la temporada';
  end if;
  return new;
end;
$$;
create trigger seasons_guard_training_groups before update of start_date,end_date on public.seasons for each row execute function public.guard_training_group_season_dates();
revoke all on function public.guard_training_group_season_dates() from public,anon,authenticated;

revoke all on function public.get_training_group_summary(uuid),public.get_training_group_workspace(uuid,uuid,date),
  public.save_training_group_draft(uuid,date,jsonb,uuid,integer),public.publish_training_group_block(uuid,integer),public.discard_training_group_draft(uuid,integer) from public,anon;
grant execute on function public.get_training_group_summary(uuid),public.get_training_group_workspace(uuid,uuid,date),
  public.save_training_group_draft(uuid,date,jsonb,uuid,integer),public.publish_training_group_block(uuid,integer),public.discard_training_group_draft(uuid,integer) to authenticated;

commit;
