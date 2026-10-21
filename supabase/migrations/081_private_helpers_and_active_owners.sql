-- Ejecutar después de 080_weekend_player_opportunities.sql en Supabase web.
-- Las comprobaciones internas de bajas siguen disponibles para las RPC y los
-- triggers SECURITY DEFINER, pero no se pueden consultar directamente por API.
begin;

revoke all on function public.player_has_absence_on(uuid,date) from public, anon, authenticated;

-- Desactivar una cuenta revoca también los accesos administrativos históricos
-- que todavía utilizan este helper en lugar de current_user_has_permission.
create or replace function public.current_user_is_owner()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.is_owner and profile.is_approved
      and profile.is_active and not profile.is_archived
  );
$$;

revoke all on function public.current_user_is_owner(),
  public.current_user_can_edit_match(uuid),
  public.current_user_can_manage_season_team(uuid) from public, anon;
grant execute on function public.current_user_is_owner(),
  public.current_user_can_edit_match(uuid),
  public.current_user_can_manage_season_team(uuid) to authenticated;

commit;
