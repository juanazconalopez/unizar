create or replace function public.can_preview_player(checked_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles owner
    where owner.id = (select auth.uid()) and owner.is_owner and owner.is_approved and owner.is_active and not owner.is_archived
  ) and exists (
    select 1 from public.profiles player
    where player.id = checked_player_id and player.is_player and player.is_approved and player.is_active and not player.is_archived
  )
$$;

revoke all on function public.can_preview_player(uuid) from public;
grant execute on function public.can_preview_player(uuid) to authenticated;
