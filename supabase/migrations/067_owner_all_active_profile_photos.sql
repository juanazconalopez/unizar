-- El owner puede administrar la foto de cualquier perfil aprobado y activo.
-- El bucket existente conserva su nombre para no mover ni duplicar fotografías.
drop policy if exists "Owners and players can read private player photos" on storage.objects;
drop policy if exists "Owners can upload private player photos" on storage.objects;
drop policy if exists "Owners can delete private player photos" on storage.objects;

create policy "Owners and users can read private profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'player-avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.current_user_can_view_private_profile_details())
  )
  and exists (
    select 1 from public.profiles target
    where target.id::text = (storage.foldername(name))[1]
      and not target.is_archived
  )
);

create policy "Owners can upload private profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-avatars'
  and (select public.current_user_can_view_private_profile_details())
  and exists (
    select 1 from public.profiles target
    where target.id::text = (storage.foldername(name))[1]
      and target.is_approved and target.is_active and not target.is_archived
  )
);

create policy "Owners can delete private profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'player-avatars'
  and (select public.current_user_can_view_private_profile_details())
);

-- La firma antigua se conserva para los clientes ya instalados.
-- La autorización deja de depender del rol de jugadora.
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
    and is_approved and is_active and not is_archived;
  if not found then
    raise exception 'Solo se pueden modificar fotografías de usuarios autorizados y activos';
  end if;
end;
$$;

revoke all on function public.set_managed_player_photo(uuid, text) from public;
grant execute on function public.set_managed_player_photo(uuid, text) to authenticated;

-- Cambiar de rol no borra una foto ya subida.
create or replace function public.update_managed_profile(
  checked_profile_id uuid,
  new_display_name text,
  new_phone text,
  new_birth_date date,
  new_is_active boolean,
  new_is_player boolean,
  new_is_coach boolean,
  new_is_viewer boolean,
  new_is_owner boolean,
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
  target_was_owner boolean;
begin
  if not (select public.current_user_can_view_private_profile_details()) then
    raise exception 'Solo un owner activo puede editar los datos de otra persona';
  end if;
  select is_owner into target_was_owner from public.profiles where id = checked_profile_id;
  if not found then raise exception 'El perfil no existe'; end if;
  if checked_profile_id = (select auth.uid()) and (not new_is_active or not new_is_owner) then
    raise exception 'No puedes desactivar tu propia cuenta ni quitarte el rol de owner';
  end if;
  if not (new_is_player or new_is_coach or new_is_viewer or new_is_owner) then
    raise exception 'Selecciona al menos un rol';
  end if;
  if target_was_owner and not new_is_owner and not exists (
    select 1 from public.profiles
    where id <> checked_profile_id and is_owner and is_approved and is_active and not is_archived
  ) then
    raise exception 'La aplicación debe conservar al menos un owner activo';
  end if;

  normalized_name := public.normalize_display_name(new_display_name);
  normalized_phone := public.normalize_international_phone(new_phone);
  if normalized_name is null
    or pg_catalog.char_length(normalized_name) < 3
    or pg_catalog.char_length(normalized_name) > 80
    or normalized_name !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
  then
    raise exception 'Escribe el nombre y al menos un apellido (entre 3 y 80 caracteres)';
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
  if new_avatar_path is not null
    and new_avatar_path !~ ('^' || checked_profile_id::text || '/[A-Za-z0-9_-]+[.]jpg$')
  then
    raise exception 'La ruta de la fotografía no es válida';
  end if;

  select email into current_email from auth.users where id = checked_profile_id;
  update public.profiles set
    display_name = normalized_name,
    is_active = new_is_active,
    is_player = new_is_player,
    is_coach = new_is_coach,
    is_viewer = new_is_viewer,
    is_owner = new_is_owner,
    avatar_path = new_avatar_path
  where id = checked_profile_id and is_approved and not is_archived;
  if not found then raise exception 'Solo se pueden editar miembros aprobados'; end if;

  insert into public.profile_private_details (profile_id, email, phone, birth_date)
  values (checked_profile_id, current_email, normalized_phone, new_birth_date)
  on conflict (profile_id) do update set
    email = excluded.email,
    phone = excluded.phone,
    birth_date = excluded.birth_date;
end;
$$;

revoke all on function public.update_managed_profile(uuid, text, text, date, boolean, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.update_managed_profile(uuid, text, text, date, boolean, boolean, boolean, boolean, boolean, text) to authenticated;
