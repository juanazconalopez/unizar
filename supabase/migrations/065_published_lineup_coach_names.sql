-- La imagen de una convocatoria publicada muestra los nombres del staff asignado.
-- La consulta devuelve solo nombres del partido que el usuario ya puede consultar.
create or replace function public.get_published_match_coaches(checked_match_id uuid)
returns table(display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select coach.display_name
  from public.matches match
  join public.season_team_coaches assignment on assignment.season_team_id = match.team_id
  join public.profiles coach on coach.id = assignment.coach_id
  where match.id = checked_match_id
    and match.lineup_published
    and match.status in ('published'::public.match_status, 'completed'::public.match_status)
    and public.current_user_has_permission('matches.view')
    and exists (
      select 1 from public.profiles caller
      where caller.id = (select auth.uid())
        and caller.is_approved and caller.is_active and not caller.is_archived
    )
    and (
      public.current_user_is_owner()
      or public.current_user_can_view_season_team(match.team_id)
      or exists (
        select 1 from public.profiles caller
        where caller.id = (select auth.uid()) and caller.is_viewer
      )
      or public.player_can_access_match(match.id, (select auth.uid()))
    )
  order by lower(coach.display_name), coach.id;
$$;

revoke all on function public.get_published_match_coaches(uuid) from public;
grant execute on function public.get_published_match_coaches(uuid) to authenticated;
