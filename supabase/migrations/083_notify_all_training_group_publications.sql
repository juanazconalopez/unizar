begin;

-- Cada publicación de un reparto debe generar un aviso nuevo para todas sus jugadoras,
-- aunque alguna conserve el mismo color que en la publicación anterior.
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
      notified_at = excluded.notified_at;
  update public.training_group_blocks set status = 'published',published_at = publication_time,published_by = (select auth.uid()),draft_members = null,version = version + 1 where id = block.id;
end;
$$;

commit;
