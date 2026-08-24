-- A profile that becomes an approved, active player joins the current season.
-- Staff-only profiles do not need a season membership. If the Player role is
-- removed later, profiles_remove_non_player_season_memberships cleans it up.

create or replace function public.assign_active_season_on_player_authorization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_approved
    and new.is_active
    and new.is_player
    and not new.is_archived
    and (
      not old.is_approved
      or not old.is_active
      or not old.is_player
      or old.is_archived
    )
  then
    insert into public.season_players (
      season_id,
      player_id,
      active_from,
      active_until
    )
    select
      s.id,
      new.id,
      current_date,
      null
    from public.seasons s
    where s.start_date <= current_date
      and s.end_date >= current_date
      and not exists (
        select 1
        from public.season_players sp
        where sp.season_id = s.id
          and sp.player_id = new.id
          and sp.active_until is null
      )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.assign_active_season_on_player_authorization() from public;

drop trigger if exists profiles_assign_active_season_on_authorization on public.profiles;
create trigger profiles_assign_active_season_on_authorization
after update of is_approved, is_active, is_player, is_archived on public.profiles
for each row execute function public.assign_active_season_on_player_authorization();
