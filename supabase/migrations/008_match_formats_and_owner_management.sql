create type public.match_kind as enum ('official', 'friendly');
create type public.rugby_format as enum ('xv', 'sevens');

alter table public.matches
  add column match_kind public.match_kind not null default 'official',
  add column rugby_format public.rugby_format not null default 'xv';

alter table public.match_lineup add column slot_number smallint;

with numbered as (
  select match_id, player_id, row_number() over (partition by match_id order by role, sort_order, player_id) as slot_number
  from public.match_lineup
)
update public.match_lineup ml
set slot_number = numbered.slot_number
from numbered
where ml.match_id = numbered.match_id and ml.player_id = numbered.player_id;

alter table public.match_lineup
  alter column slot_number set not null,
  add constraint match_lineup_slot_range check (slot_number between 1 and 23),
  add constraint match_lineup_unique_slot unique (match_id, slot_number);

create or replace function public.player_can_access_match(checked_match_id uuid, checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches m
    join public.season_players sp on sp.season_id = m.season_id and sp.player_id = checked_player_id
    join public.profiles p on p.id = checked_player_id
    where m.id = checked_match_id and m.status <> 'draft'
      and p.is_approved and p.is_active and not p.is_archived and not p.is_owner and not p.is_collaborator
      and sp.active_from <= m.match_date
      and (sp.active_until is null or sp.active_until >= m.match_date)
  );
$$;

create or replace function public.current_user_can_edit_match(checked_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_is_owner()
    and exists (select 1 from public.matches m where m.id = checked_match_id);
$$;

drop policy "Players can read published matches" on public.matches;
drop policy "Managers can create matches" on public.matches;
drop policy "Creators and owners can update matches" on public.matches;
drop policy "Creators and owners can delete matches" on public.matches;
drop policy "Players and managers can read availability" on public.match_availability;
drop policy "Managers and selected players can read lineups" on public.match_lineup;

create policy "Owners and players can read matches" on public.matches for select to authenticated using (
  (select public.current_user_is_owner()) or public.player_can_access_match(id, (select auth.uid()))
);
create policy "Owners can create matches" on public.matches for insert to authenticated with check (
  (select public.current_user_is_owner()) and created_by = (select auth.uid())
);
create policy "Owners can update matches" on public.matches for update to authenticated
using ((select public.current_user_is_owner())) with check ((select public.current_user_is_owner()));
create policy "Owners can delete matches" on public.matches for delete to authenticated using ((select public.current_user_is_owner()));
create policy "Players and owners can read availability" on public.match_availability for select to authenticated using (
  player_id = (select auth.uid()) or (select public.current_user_is_owner())
);
create policy "Owners and selected players can read lineups" on public.match_lineup for select to authenticated using (
  (select public.current_user_is_owner()) or (
    public.player_can_access_match(match_id, (select auth.uid()))
    and exists (select 1 from public.matches m where m.id = match_id and m.lineup_published)
  )
);

create or replace function public.save_match_lineup(
  checked_match_id uuid,
  lineup_entries jsonb,
  publish_lineup boolean
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  maximum_slots smallint;
  starter_slots smallint;
begin
  if not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permisos para editar esta convocatoria';
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
      or p.is_archived or p.is_owner or p.is_collaborator
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
