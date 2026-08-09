-- La disponibilidad se cierra al publicar y cualquier baja previa sale de la alineación provisional.
create or replace function public.guard_match_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  is_published boolean;
begin
  select lineup_published into is_published
  from public.matches
  where id = new.match_id
  for update;

  if is_published then
    raise exception 'La disponibilidad está cerrada porque la convocatoria ya está publicada';
  end if;

  if new.status <> 'available'::public.availability_status then
    delete from public.match_lineup
    where match_id = new.match_id and player_id = new.player_id;
  end if;

  return new;
end;
$$;

create trigger match_availability_guard_lineup
before insert or update on public.match_availability
for each row execute function public.guard_match_availability();

create or replace function public.save_match_lineup(
  checked_match_id uuid,
  lineup_entries jsonb,
  publish_lineup boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  maximum_slots integer;
  starter_slots integer;
  was_published boolean;
begin
  if not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permiso para gestionar esta alineación';
  end if;

  select
    case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end,
    lineup_published
  into maximum_slots, starter_slots, was_published
  from public.matches
  where id = checked_match_id
  for update;

  if exists (
    select 1 from jsonb_array_elements(lineup_entries) as entries(entry)
    where (entry->>'slot_number')::smallint not between 1 and maximum_slots
  ) then
    raise exception 'El dorsal no es válido para este tipo de partido';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(lineup_entries) as entries(entry)
    left join public.matches m on m.id = checked_match_id
    left join public.season_players sp
      on sp.season_id = m.season_id
      and sp.player_id = (entry->>'player_id')::uuid
      and sp.active_from <= m.match_date
      and (sp.active_until is null or sp.active_until >= m.match_date)
    left join public.profiles p on p.id = (entry->>'player_id')::uuid
    left join public.match_availability ma
      on ma.match_id = checked_match_id
      and ma.player_id = (entry->>'player_id')::uuid
      and ma.status = 'available'::public.availability_status
    where sp.id is null or p.id is null or ma.player_id is null
      or not p.is_approved or not p.is_active or p.is_archived or p.is_owner
  ) then
    raise exception 'La convocatoria contiene una jugadora que ya no está disponible';
  end if;

  delete from public.match_lineup where match_id = checked_match_id;

  insert into public.match_lineup (match_id, player_id, role, position, slot_number, sort_order)
  select
    checked_match_id,
    (entry->>'player_id')::uuid,
    case when (entry->>'slot_number')::smallint <= starter_slots then 'starter'::public.lineup_role else 'substitute'::public.lineup_role end,
    null,
    (entry->>'slot_number')::smallint,
    (entry->>'slot_number')::smallint
  from jsonb_array_elements(lineup_entries) as entries(entry);

  update public.matches set lineup_published = was_published or publish_lineup where id = checked_match_id;
end;
$$;
