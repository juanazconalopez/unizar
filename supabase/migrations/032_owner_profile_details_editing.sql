-- El owner puede corregir los datos administrativos de una persona sin poder
-- sustituir el email verificado que procede de su cuenta de Google.
create or replace function public.update_profile_details_as_owner(
  checked_profile_id uuid,
  new_display_name text,
  new_phone text,
  new_birth_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  normalized_phone text;
  current_email text;
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_owner
      and is_approved
      and is_active
      and not is_archived
  ) then
    raise exception 'Solo un owner activo puede editar los datos de otra persona';
  end if;

  if not exists (select 1 from public.profiles where id = checked_profile_id) then
    raise exception 'El perfil no existe';
  end if;

  normalized_name := public.normalize_display_name(new_display_name);
  normalized_phone := nullif(pg_catalog.btrim(new_phone), '');

  if normalized_name is null
    or pg_catalog.char_length(normalized_name) < 3
    or pg_catalog.char_length(normalized_name) > 80
    or normalized_name !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
  then
    raise exception 'Escribe el nombre y al menos un apellido (entre 3 y 80 caracteres)';
  end if;

  if normalized_phone is not null
    and (pg_catalog.char_length(normalized_phone) < 6 or pg_catalog.char_length(normalized_phone) > 30)
  then
    raise exception 'Escribe un teléfono válido (entre 6 y 30 caracteres)';
  end if;

  if new_birth_date is not null
    and (new_birth_date < date '1900-01-01' or new_birth_date > current_date)
  then
    raise exception 'Escribe una fecha de nacimiento válida';
  end if;

  select email into current_email from auth.users where id = checked_profile_id;

  update public.profiles
  set display_name = normalized_name
  where id = checked_profile_id;

  insert into public.profile_private_details (profile_id, email, phone, birth_date)
  values (checked_profile_id, current_email, normalized_phone, new_birth_date)
  on conflict (profile_id) do update set
    email = excluded.email,
    phone = excluded.phone,
    birth_date = excluded.birth_date;
end;
$$;

revoke all on function public.update_profile_details_as_owner(uuid, text, text, date) from public;
grant execute on function public.update_profile_details_as_owner(uuid, text, text, date) to authenticated;
