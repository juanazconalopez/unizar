-- Datos personales separados del perfil deportivo. Esta tabla no comparte las
-- políticas amplias de public.profiles: cada persona ve sus propios datos y el
-- owner puede consultarlos desde la administración del equipo.
create table public.profile_private_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email text,
  phone text,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_private_details_phone_length
    check (phone is null or char_length(phone) between 6 and 30),
  constraint profile_private_details_birth_date_minimum
    check (birth_date is null or birth_date >= date '1900-01-01')
);

create trigger profile_private_details_set_updated_at
before update on public.profile_private_details
for each row execute function public.set_updated_at();

alter table public.profile_private_details enable row level security;

create or replace function public.current_user_can_view_private_profile_details()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_owner
      and is_approved
      and is_active
      and not is_archived
  );
$$;

revoke all on function public.current_user_can_view_private_profile_details() from public;
grant execute on function public.current_user_can_view_private_profile_details() to authenticated;

create policy "Users can read their own private profile details"
on public.profile_private_details for select to authenticated
using (profile_id = (select auth.uid()));

create policy "Owners can read private profile details"
on public.profile_private_details for select to authenticated
using ((select public.current_user_can_view_private_profile_details()));

-- Las escrituras pasan exclusivamente por update_own_profile_details para no
-- conceder UPDATE directo sobre datos o permisos ajenos.
revoke insert, update, delete on public.profile_private_details from anon, authenticated;
grant select on public.profile_private_details to authenticated;

-- Crear los detalles privados junto al perfil y conservar el email verificado
-- por el proveedor de autenticación.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'Jugador'
    )
  );

  insert into public.profile_private_details (profile_id, email)
  values (new.id, new.email);

  return new;
end;
$$;

-- Completar las cuentas ya existentes.
insert into public.profile_private_details (profile_id, email)
select profile.id, auth_user.email
from public.profiles profile
join auth.users auth_user on auth_user.id = profile.id
on conflict (profile_id) do update set email = excluded.email;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_private_details (profile_id, email)
  values (new.id, new.email)
  on conflict (profile_id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger auth_user_email_sync
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_profile_email();

create or replace function public.update_own_profile_details(
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
      and is_approved
      and is_active
      and not is_archived
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
    and (pg_catalog.char_length(normalized_phone) < 6 or pg_catalog.char_length(normalized_phone) > 30)
  then
    raise exception 'Escribe un teléfono válido (entre 6 y 30 caracteres)';
  end if;

  if new_birth_date is not null
    and (new_birth_date < date '1900-01-01' or new_birth_date > current_date)
  then
    raise exception 'Escribe una fecha de nacimiento válida';
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

revoke all on function public.update_own_profile_details(text, text, date) from public;
grant execute on function public.update_own_profile_details(text, text, date) to authenticated;
