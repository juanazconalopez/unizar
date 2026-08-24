-- Una convocatoria publicada solo puede volver a edición mediante una acción
-- explícita de un entrenador activo. Al desbloquearla deja de ser visible como
-- convocatoria publicada hasta que el entrenador vuelva a publicarla.
create or replace function public.unlock_match_lineup(checked_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_coach
      and is_approved
      and is_active
      and not is_archived
  ) then
    raise exception 'Solo un entrenador activo puede desbloquear la convocatoria';
  end if;

  update public.matches
  set lineup_published = false
  where id = checked_match_id and lineup_published;

  if not found and not exists (select 1 from public.matches where id = checked_match_id) then
    raise exception 'No se ha encontrado el partido';
  end if;
end;
$$;

revoke all on function public.unlock_match_lineup(uuid) from public;
grant execute on function public.unlock_match_lineup(uuid) to authenticated;
