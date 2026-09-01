-- Foto privada de jugadoras y edición administrativa atómica de su ficha.
-- El bucket almacena una única versión comprimida por cambio; la aplicación
-- elimina la anterior después de actualizar correctamente el perfil.
alter table public.profiles
  add column avatar_path text;

alter table public.profiles
  add constraint profiles_avatar_path_format
  check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/[A-Za-z0-9_-]+[.]jpg$')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-avatars', 'player-avatars', false, 307200, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners and players can read private player photos"
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
      and target.is_player
      and not target.is_archived
  )
);

create policy "Owners and players can upload private player photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-avatars'
  and (
    (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1 from public.profiles own_profile
        where own_profile.id = (select auth.uid())
          and own_profile.is_player
          and own_profile.is_approved
          and own_profile.is_active
          and not own_profile.is_archived
      )
    )
    or (select public.current_user_can_view_private_profile_details())
  )
);

create policy "Owners and players can delete private player photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'player-avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.current_user_can_view_private_profile_details())
  )
);

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
  normalized_phone := nullif(pg_catalog.btrim(new_phone), '');

  if normalized_name is null
    or pg_catalog.char_length(normalized_name) < 3
    or pg_catalog.char_length(normalized_name) > 80
    or normalized_name !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
  then
    raise exception 'Escribe tu nombre y al menos un apellido (entre 3 y 80 caracteres)';
  end if;
  if normalized_phone is not null
    and pg_catalog.char_length(normalized_phone) not between 6 and 30
  then
    raise exception 'Escribe un teléfono válido (entre 6 y 30 caracteres)';
  end if;
  if new_birth_date is not null
    and (new_birth_date < date '1900-01-01' or new_birth_date > current_date)
  then
    raise exception 'Escribe una fecha de nacimiento válida';
  end if;
  if new_avatar_path is not null
    and new_avatar_path !~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9_-]+[.]jpg$')
  then
    raise exception 'La ruta de la fotografía no es válida';
  end if;

  select email into current_email from auth.users where id = (select auth.uid());

  update public.profiles
  set display_name = normalized_name,
      avatar_path = case when is_player then new_avatar_path else null end
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
  normalized_phone := nullif(pg_catalog.btrim(new_phone), '');
  if normalized_name is null
    or pg_catalog.char_length(normalized_name) < 3
    or pg_catalog.char_length(normalized_name) > 80
    or normalized_name !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
  then
    raise exception 'Escribe el nombre y al menos un apellido (entre 3 y 80 caracteres)';
  end if;
  if normalized_phone is not null
    and pg_catalog.char_length(normalized_phone) not between 6 and 30
  then
    raise exception 'Escribe un teléfono válido (entre 6 y 30 caracteres)';
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
    avatar_path = case when new_is_player then new_avatar_path else null end
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

create or replace function public.archive_profile_as_owner(checked_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.current_user_can_view_private_profile_details()) then
    raise exception 'Solo un owner activo puede desautorizar personas';
  end if;
  if checked_profile_id = (select auth.uid()) then
    raise exception 'No puedes desautorizar tu propia cuenta';
  end if;
  if exists (select 1 from public.profiles where id = checked_profile_id and is_owner)
    and not exists (
      select 1 from public.profiles
      where id <> checked_profile_id and is_owner and is_approved and is_active and not is_archived
    )
  then
    raise exception 'La aplicación debe conservar al menos un owner activo';
  end if;

  update public.profiles set
    is_approved = false,
    is_active = false,
    is_archived = true
  where id = checked_profile_id;
  if not found then raise exception 'El perfil no existe'; end if;
end;
$$;

revoke all on function public.archive_profile_as_owner(uuid) from public;
grant execute on function public.archive_profile_as_owner(uuid) to authenticated;
