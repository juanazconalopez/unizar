-- Evita la recursión de RLS al leer profiles durante el arranque.
-- La policy antigua consultaba match_lineup directamente y acababa
-- reentrando en políticas que vuelven a leer profiles.
create or replace function public.current_user_can_read_published_lineup_profile(checked_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_lineup lineup
    join public.matches match on match.id = lineup.match_id
    where lineup.player_id = checked_profile_id
      and match.lineup_published
      and public.player_can_access_match(match.id, (select auth.uid()))
  );
$$;

revoke all on function public.current_user_can_read_published_lineup_profile(uuid) from public;
grant execute on function public.current_user_can_read_published_lineup_profile(uuid) to authenticated;

drop policy if exists "Players can read published lineup profiles" on public.profiles;
create policy "Players can read published lineup profiles"
on public.profiles
for select
to authenticated
using (
  (select public.current_user_can_read_published_lineup_profile(profiles.id))
);
