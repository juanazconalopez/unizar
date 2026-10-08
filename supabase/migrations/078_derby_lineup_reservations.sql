-- Ejecutar después de 077_cross_team_callup_limit.sql en Supabase web.
-- Los entrenadores consultan reservas del derbi sin leer dorsales ni el borrador ajeno.
begin;

create function public.get_derby_reserved_player_ids(checked_match_id uuid)
returns uuid[] language plpgsql stable security definer set search_path = '' as $$
declare player_ids uuid[];
begin
  if not public.current_user_has_permission('matches.lineup_edit')
    or not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'No tienes permiso para comprobar las reservas de esta convocatoria';
  end if;
  select coalesce(array_agg(distinct lineup.player_id), '{}'::uuid[]) into player_ids
  from public.matches target
  join public.matches other on other.id <> target.id
    and target.internal_fixture_id is not null
    and other.internal_fixture_id = target.internal_fixture_id
    and other.season_id = target.season_id and other.match_date = target.match_date
  join public.match_lineup lineup on lineup.match_id = other.id
  where target.id = checked_match_id;
  return player_ids;
end;
$$;

revoke all on function public.get_derby_reserved_player_ids(uuid) from public,anon;
grant execute on function public.get_derby_reserved_player_ids(uuid) to authenticated;

commit;
