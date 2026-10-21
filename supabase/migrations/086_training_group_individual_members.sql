-- Gestión individual de altas y retiradas en repartos existentes.
-- Ejecutar completa después de 085 en el SQL Editor de Supabase.
-- Se conserva la firma de las RPC: el listado enviado contiene únicamente
-- las jugadoras asignadas; la ausencia significa «Sin grupo» para el staff.
begin;

create or replace function public.save_training_group_draft(checked_season_id uuid,starts_on date,members jsonb,checked_block_id uuid default null,expected_version integer default null)
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
  if jsonb_array_length(members) > 2000 then raise exception 'El reparto no tiene un número válido de jugadoras'; end if;
  if exists (select 1 from jsonb_array_elements(members) entry where jsonb_typeof(entry) <> 'object' or entry->>'player_id' is null or coalesce(entry->>'color','') not in ('red','white')) then raise exception 'Hay asignaciones incompletas o colores no válidos'; end if;
  if (select count(distinct (entry->>'player_id')::uuid) from jsonb_array_elements(members) entry) <> jsonb_array_length(members) then raise exception 'Una jugadora no puede estar en los dos grupos'; end if;
  effective_date := greatest(starts_on,today);
  if exists (select 1 from jsonb_array_elements(members) entry where not exists (
    select 1 from public.training_group_roster(checked_season_id,effective_date) eligible where eligible.player_id = (entry->>'player_id')::uuid
  )) then raise exception 'La plantilla ha cambiado. Actualiza las jugadoras elegibles antes de guardar'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('player_id',(entry->>'player_id')::uuid,'color',entry->>'color')),'[]'::jsonb) into canonical from jsonb_array_elements(members) entry;
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

create or replace function public.publish_training_group_block(checked_block_id uuid,expected_version integer)
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
  -- Un borrador representa el subconjunto que el staff ha decidido asignar.
  -- Las altas pendientes y las retiradas manuales pueden quedarse sin grupo.
  if jsonb_typeof(block.draft_members) <> 'array' or jsonb_array_length(block.draft_members) > 2000 then
    raise exception 'El reparto debe ser una lista válida de jugadoras';
  end if;
  if exists(select 1 from jsonb_array_elements(block.draft_members) entry
    where jsonb_typeof(entry) <> 'object' or entry->>'player_id' is null or coalesce(entry->>'color','') not in ('red','white')) then
    raise exception 'Hay asignaciones incompletas o colores no válidos';
  end if;
  if (select count(distinct (entry->>'player_id')::uuid) from jsonb_array_elements(block.draft_members) entry) <> jsonb_array_length(block.draft_members) then
    raise exception 'Una jugadora no puede estar en los dos grupos';
  end if;
  if exists (
    select (entry->>'player_id')::uuid from jsonb_array_elements(block.draft_members) entry
    except select eligible.player_id from public.training_group_roster(block.season_id,effective_date) eligible
  ) then raise exception 'La plantilla ha cambiado. Actualiza el borrador antes de publicar'; end if;
  delete from public.training_group_members member where member.block_id = block.id
    and not exists (select 1 from jsonb_array_elements(block.draft_members) entry where (entry->>'player_id')::uuid = member.player_id);
  insert into public.training_group_members(block_id,player_id,color,team_id,team_name,position_group,notified_at)
    select block.id,eligible.player_id,entry->>'color',eligible.team_id,eligible.team_name,eligible.position_group,publication_time
    from jsonb_array_elements(block.draft_members) entry join public.training_group_roster(block.season_id,effective_date) eligible on eligible.player_id = (entry->>'player_id')::uuid
    on conflict (block_id,player_id) do update set color = excluded.color,team_id = excluded.team_id,team_name = excluded.team_name,position_group = excluded.position_group,
      notified_at = excluded.notified_at;
  update public.training_group_blocks set status = 'published',published_at = publication_time,published_by = (select auth.uid()),draft_members = null,version = version + 1 where id = block.id;
end;
$$;

revoke all on function public.save_training_group_draft(uuid,date,jsonb,uuid,integer),public.publish_training_group_block(uuid,integer) from public,anon;
grant execute on function public.save_training_group_draft(uuid,date,jsonb,uuid,integer),public.publish_training_group_block(uuid,integer) to authenticated;

commit;
