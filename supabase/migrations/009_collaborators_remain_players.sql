-- Ser colaboradora añade permisos de gestión de tareas, pero no elimina su condición de jugadora.
create or replace function public.player_can_access_match(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches m
    join public.season_players sp on sp.season_id = m.season_id and sp.player_id = checked_player_id
    join public.profiles p on p.id = checked_player_id
    where m.id = checked_match_id and m.status <> 'draft'
      and p.is_approved and p.is_active and not p.is_archived and not p.is_owner
      and sp.active_from <= m.match_date
      and (sp.active_until is null or sp.active_until >= m.match_date)
  );
$$;

create or replace function public.save_match_lineup(
  checked_match_id uuid,
  lineup_entries jsonb,
  publish_lineup boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  maximum_slots integer;
  starter_slots integer;
begin
  if not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permiso para gestionar esta alineación';
  end if;

  select
    case when match_kind = 'official' then 23 when rugby_format = 'sevens' then 7 else 15 end,
    case when rugby_format = 'sevens' then 7 else 15 end
  into maximum_slots, starter_slots
  from public.matches where id = checked_match_id;

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
    where sp.id is null or p.id is null or not p.is_approved or not p.is_active
      or p.is_archived or p.is_owner
  ) then
    raise exception 'La convocatoria contiene una jugadora no elegible para el partido';
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

  update public.matches set lineup_published = publish_lineup where id = checked_match_id;
end;
$$;
