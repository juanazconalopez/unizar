-- Approved, active users can change only their own application display name.
-- Keeping this behind a narrow SECURITY DEFINER function avoids granting broad
-- profile UPDATE access, which also contains role and approval columns.

create or replace function public.update_own_display_name(new_display_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_approved
      and is_active
      and not is_archived
  ) then
    raise exception 'Solo los usuarios aprobados y activos pueden editar su nombre';
  end if;

  normalized_name := public.normalize_display_name(new_display_name);

  if normalized_name is null
    or pg_catalog.char_length(normalized_name) < 3
    or pg_catalog.char_length(normalized_name) > 80
    or normalized_name !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
  then
    raise exception 'Escribe tu nombre y al menos un apellido (entre 3 y 80 caracteres)';
  end if;

  update public.profiles
  set display_name = normalized_name
  where id = (select auth.uid());

  return normalized_name;
end;
$$;

revoke all on function public.update_own_display_name(text) from public;
grant execute on function public.update_own_display_name(text) to authenticated;
