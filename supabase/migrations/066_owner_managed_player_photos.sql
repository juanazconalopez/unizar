-- El owner administra las fotos de jugadoras desde Datos de perfil.
-- Las jugadoras conservan la lectura de su imagen, pero no pueden subirla ni borrarla.
drop policy if exists "Owners and players can upload private player photos" on storage.objects;
drop policy if exists "Owners and players can delete private player photos" on storage.objects;

create policy "Owners can upload private player photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-avatars'
  and (select public.current_user_can_view_private_profile_details())
  and exists (
    select 1 from public.profiles target
    where target.id::text = (storage.foldername(name))[1]
      and target.is_player and target.is_approved and not target.is_archived
  )
);

create policy "Owners can delete private player photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'player-avatars'
  and (select public.current_user_can_view_private_profile_details())
);

-- Se conserva la firma usada por los clientes existentes, pero la foto no puede
-- cambiarse al guardar nombre y datos privados del propio perfil.
create or replace function public.update_own_profile(
  new_display_name text,
  new_phone text,
  new_birth_date date,
  new_avatar_path text
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
      and is_approved and is_active and not is_archived
  ) then
    raise exception 'Solo los usuarios aprobados y activos pueden editar su perfil';
  end if;

  normalized_name := public.normalize_display_name(new_display_name);
  normalized_phone := public.normalize_international_phone(new_phone);
  if normalized_name is null
    or pg_catalog.char_length(normalized_name) < 3
    or pg_catalog.char_length(normalized_name) > 80
    or normalized_name !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
  then
    raise exception 'Escribe tu nombre y al menos un apellido (entre 3 y 80 caracteres)';
  end if;
  if normalized_phone is not null
    and not public.is_valid_international_phone(normalized_phone)
  then
    raise exception 'Escribe un teléfono internacional válido';
  end if;
  if new_birth_date is not null
    and (new_birth_date < date '1900-01-01' or new_birth_date > current_date)
  then
    raise exception 'Escribe una fecha de nacimiento válida';
  end if;
  if new_avatar_path is distinct from (
    select avatar_path from public.profiles where id = (select auth.uid())
  ) then
    raise exception 'Solo el owner puede modificar la fotografía de perfil';
  end if;

  select email into current_email from auth.users where id = (select auth.uid());
  update public.profiles
  set display_name = normalized_name
  where id = (select auth.uid());

  insert into public.profile_private_details (profile_id, email, phone, birth_date)
  values ((select auth.uid()), current_email, normalized_phone, new_birth_date)
  on conflict (profile_id) do update set
    email = excluded.email,
    phone = excluded.phone,
    birth_date = excluded.birth_date;
end;
$$;

revoke all on function public.update_own_profile(text, text, date, text) from public;
grant execute on function public.update_own_profile(text, text, date, text) to authenticated;

create or replace function public.set_managed_player_photo(
  checked_profile_id uuid,
  new_avatar_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.current_user_can_view_private_profile_details()) then
    raise exception 'Solo un owner activo puede modificar fotografías';
  end if;
  if new_avatar_path is not null
    and new_avatar_path !~ ('^' || checked_profile_id::text || '/[A-Za-z0-9_-]+[.]jpg$')
  then
    raise exception 'La ruta de la fotografía no es válida';
  end if;

  update public.profiles
  set avatar_path = new_avatar_path
  where id = checked_profile_id
    and is_player and is_approved and not is_archived;
  if not found then
    raise exception 'Solo se pueden modificar fotografías de jugadoras autorizadas';
  end if;
end;
$$;

revoke all on function public.set_managed_player_photo(uuid, text) from public;
grant execute on function public.set_managed_player_photo(uuid, text) to authenticated;
