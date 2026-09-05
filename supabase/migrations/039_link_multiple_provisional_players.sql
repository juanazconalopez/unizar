-- El owner puede confirmar varias identidades provisionales para una misma
-- jugadora. Si una de ellas deja de estar disponible, la transacción completa
-- se revierte y no se migra ningún historial parcialmente.
create or replace function public.link_provisional_players(
  checked_provisional_player_ids uuid[],
  checked_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked_provisional_player_id uuid;
begin
  if not public.current_user_is_owner() then
    raise exception 'Solo el owner puede vincular asistencias de invitadas';
  end if;

  if coalesce(cardinality(checked_provisional_player_ids), 0) = 0 then
    raise exception 'Selecciona al menos una invitada';
  end if;

  if exists (
    select 1
    from unnest(checked_provisional_player_ids) as selected_provisional(player_id)
    where selected_provisional.player_id is null
  ) or exists (
    select 1
    from unnest(checked_provisional_player_ids) as selected_provisional(player_id)
    group by selected_provisional.player_id
    having count(*) > 1
  ) then
    raise exception 'La lista de invitadas no es válida';
  end if;

  foreach checked_provisional_player_id in array checked_provisional_player_ids
  loop
    perform public.link_provisional_player(
      checked_provisional_player_id,
      checked_profile_id
    );
  end loop;
end;
$$;

revoke all on function public.link_provisional_players(uuid[], uuid) from public;
grant execute on function public.link_provisional_players(uuid[], uuid) to authenticated;
