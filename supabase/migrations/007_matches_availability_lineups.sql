create type public.match_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.availability_status as enum ('available', 'doubt', 'unavailable');
create type public.lineup_role as enum ('starter', 'substitute');

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  opponent text not null check (length(trim(opponent)) > 0),
  match_date date not null,
  kickoff_time time,
  venue text,
  is_home boolean not null default true,
  notes text,
  status public.match_status not null default 'draft',
  lineup_published boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_availability (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status public.availability_status not null,
  comment text,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create table public.match_lineup (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  role public.lineup_role not null,
  position text,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index matches_date_idx on public.matches (match_date desc);
create index match_availability_player_idx on public.match_availability (player_id);
create index match_lineup_order_idx on public.match_lineup (match_id, role, sort_order);

alter table public.matches enable row level security;
alter table public.match_availability enable row level security;
alter table public.match_lineup enable row level security;

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

create or replace function public.current_user_can_edit_match(checked_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_is_owner() or exists (
    select 1 from public.matches m where m.id = checked_match_id
      and m.created_by = (select auth.uid()) and public.current_user_can_manage_tasks()
  );
$$;

create policy "Players can read published matches" on public.matches for select to authenticated using (
  (select public.current_user_can_manage_tasks())
  or (status <> 'draft' and public.player_can_access_match(id, (select auth.uid())))
);
create policy "Managers can create matches" on public.matches for insert to authenticated with check (
  (select public.current_user_can_manage_tasks()) and created_by = (select auth.uid())
);
create policy "Creators and owners can update matches" on public.matches for update to authenticated
using ((select public.current_user_is_owner()) or ((select public.current_user_can_manage_tasks()) and created_by = (select auth.uid())))
with check ((select public.current_user_is_owner()) or ((select public.current_user_can_manage_tasks()) and created_by = (select auth.uid())));
create policy "Creators and owners can delete matches" on public.matches for delete to authenticated using (
  (select public.current_user_is_owner()) or ((select public.current_user_can_manage_tasks()) and created_by = (select auth.uid()))
);

create policy "Players and managers can read availability" on public.match_availability for select to authenticated using (
  player_id = (select auth.uid()) or (select public.current_user_can_manage_tasks())
);
create policy "Players can create availability" on public.match_availability for insert to authenticated with check (
  player_id = (select auth.uid()) and public.player_can_access_match(match_id, player_id)
  and exists (select 1 from public.matches m where m.id = match_id and m.status = 'published')
);
create policy "Players can update availability" on public.match_availability for update to authenticated
using (player_id = (select auth.uid()))
with check (
  player_id = (select auth.uid()) and public.player_can_access_match(match_id, player_id)
  and exists (select 1 from public.matches m where m.id = match_id and m.status = 'published')
);

create policy "Managers and selected players can read lineups" on public.match_lineup for select to authenticated using (
  (select public.current_user_can_manage_tasks()) or (
    public.player_can_access_match(match_id, (select auth.uid()))
    and exists (select 1 from public.matches m where m.id = match_id and m.lineup_published)
  )
);
create policy "Players can read published lineup profiles" on public.profiles for select to authenticated using (
  exists (
    select 1 from public.match_lineup ml join public.matches m on m.id = ml.match_id
    where ml.player_id = profiles.id and m.lineup_published
      and public.player_can_access_match(m.id, (select auth.uid()))
  )
);
create policy "Managers can create lineup" on public.match_lineup for insert to authenticated with check (public.current_user_can_edit_match(match_id));
create policy "Managers can update lineup" on public.match_lineup for update to authenticated
using (public.current_user_can_edit_match(match_id)) with check (public.current_user_can_edit_match(match_id));
create policy "Managers can delete lineup" on public.match_lineup for delete to authenticated using (public.current_user_can_edit_match(match_id));

create or replace function public.save_match_lineup(
  checked_match_id uuid,
  lineup_entries jsonb,
  publish_lineup boolean
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permisos para editar esta convocatoria';
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
    where sp.id is null or p.id is null or not p.is_approved or not p.is_active or p.is_archived or p.is_owner
  ) then
    raise exception 'La convocatoria contiene una jugadora no elegible para el partido';
  end if;

  delete from public.match_lineup where match_id = checked_match_id;

  insert into public.match_lineup (match_id, player_id, role, position, sort_order)
  select
    checked_match_id,
    (entry->>'player_id')::uuid,
    (entry->>'role')::public.lineup_role,
    nullif(trim(entry->>'position'), ''),
    coalesce((entry->>'sort_order')::smallint, 0)
  from jsonb_array_elements(lineup_entries) as entries(entry);

  update public.matches set lineup_published = publish_lineup where id = checked_match_id;
end;
$$;

create trigger matches_set_updated_at before update on public.matches for each row execute function public.set_updated_at();
create trigger match_availability_set_updated_at before update on public.match_availability for each row execute function public.set_updated_at();
create trigger match_lineup_set_updated_at before update on public.match_lineup for each row execute function public.set_updated_at();

grant execute on function public.player_can_access_match(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_edit_match(uuid) to authenticated;
grant execute on function public.save_match_lineup(uuid, jsonb, boolean) to authenticated;
