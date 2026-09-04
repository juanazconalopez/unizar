-- Catálogo de metadatos de la carpeta compartida de Google Drive.
-- Los archivos no se copian a Supabase: se conservan sus enlaces de Drive.

create table public.library_settings (
  id boolean primary key default true,
  root_folder_id text,
  root_folder_url text,
  root_resource_key text,
  sync_status text not null default 'idle'
    check (sync_status in ('idle', 'running', 'succeeded', 'failed')),
  sync_error text,
  item_count integer not null default 0
    check (item_count >= 0),
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),

  constraint library_settings_singleton check (id)
);

create table public.library_items (
  drive_file_id text primary key,
  parent_drive_id text,
  name text not null,
  mime_type text not null,
  size_bytes bigint,
  modified_at timestamptz,
  web_view_link text,
  web_content_link text,
  resource_key text,
  is_folder boolean not null default false,
  synced_at timestamptz not null default now()
);

create index library_items_parent_idx
  on public.library_items (parent_drive_id, name);

create index library_items_mime_idx
  on public.library_items (mime_type);

alter table public.library_settings enable row level security;
alter table public.library_items enable row level security;

create or replace function public.current_user_can_read_library()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_approved = true
      and is_active = true
      and is_archived = false
  );
$$;

revoke all on function public.current_user_can_read_library() from public;
grant execute on function public.current_user_can_read_library() to authenticated;

create policy "Owners can read library settings"
on public.library_settings for select to authenticated
using ((select public.current_user_is_owner()));

create policy "Owners can insert library settings"
on public.library_settings for insert to authenticated
with check ((select public.current_user_is_owner()));

create policy "Owners can update library settings"
on public.library_settings for update to authenticated
using ((select public.current_user_is_owner()))
with check ((select public.current_user_is_owner()));

create policy "Approved active users can read library items"
on public.library_items for select to authenticated
using ((select public.current_user_can_read_library()));

create or replace function public.set_library_folder(
  checked_folder_id text,
  checked_folder_url text,
  checked_resource_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.current_user_is_owner()) then
    raise exception 'Solo el owner puede cambiar la carpeta de la librería';
  end if;
  if nullif(trim(checked_folder_id), '') is null then
    raise exception 'La carpeta raíz de Drive es obligatoria';
  end if;

  -- pg_safeupdate (activo en Supabase) exige una cláusula WHERE incluso
  -- cuando la intención es vaciar el catálogo completo.
  delete from public.library_items
  where drive_file_id is not null;
  insert into public.library_settings (
    id, root_folder_id, root_folder_url, root_resource_key,
    sync_status, sync_error, item_count, last_synced_at, updated_at, updated_by
  )
  values (
    true, checked_folder_id, checked_folder_url, checked_resource_key,
    'idle', null, 0, null, now(), (select auth.uid())
  )
  on conflict (id) do update set
    root_folder_id = excluded.root_folder_id,
    root_folder_url = excluded.root_folder_url,
    root_resource_key = excluded.root_resource_key,
    sync_status = excluded.sync_status,
    sync_error = excluded.sync_error,
    item_count = excluded.item_count,
    last_synced_at = excluded.last_synced_at,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_library_folder(text, text, text) from public, anon;
grant execute on function public.set_library_folder(text, text, text) to authenticated;

-- La Edge Function usa esta RPC con el rol service_role para reemplazar el
-- catálogo completo de forma atómica después de recorrer Drive.
create or replace function public.replace_library_catalog(
  checked_folder_id text,
  checked_folder_url text,
  checked_resource_key text,
  checked_items jsonb,
  checked_synced_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if nullif(trim(checked_folder_id), '') is null then
    raise exception 'La carpeta raíz de Drive es obligatoria';
  end if;

  if jsonb_typeof(checked_items) <> 'array' then
    raise exception 'El catálogo de Drive debe ser un array JSON';
  end if;

  delete from public.library_items as existing
  where not exists (
    select 1
    from jsonb_array_elements(checked_items) as item
    where item->>'drive_file_id' = existing.drive_file_id
  );

  insert into public.library_items (
    drive_file_id, parent_drive_id, name, mime_type, size_bytes,
    modified_at, web_view_link, web_content_link, resource_key,
    is_folder, synced_at
  )
  select
    item->>'drive_file_id',
    nullif(item->>'parent_drive_id', ''),
    item->>'name',
    item->>'mime_type',
    nullif(item->>'size_bytes', '')::bigint,
    nullif(item->>'modified_at', '')::timestamptz,
    nullif(item->>'web_view_link', ''),
    nullif(item->>'web_content_link', ''),
    nullif(item->>'resource_key', ''),
    coalesce((item->>'is_folder')::boolean, false),
    checked_synced_at
  from jsonb_array_elements(checked_items) as item
  where nullif(item->>'drive_file_id', '') is not null
    and nullif(item->>'name', '') is not null
    and nullif(item->>'mime_type', '') is not null
  on conflict (drive_file_id) do update set
    parent_drive_id = excluded.parent_drive_id,
    name = excluded.name,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    modified_at = excluded.modified_at,
    web_view_link = excluded.web_view_link,
    web_content_link = excluded.web_content_link,
    resource_key = excluded.resource_key,
    is_folder = excluded.is_folder,
    synced_at = excluded.synced_at;

  get diagnostics inserted_count = row_count;

  insert into public.library_settings (
    id, root_folder_id, root_folder_url, root_resource_key,
    sync_status, sync_error, item_count, last_synced_at, updated_at
  )
  values (
    true, checked_folder_id, checked_folder_url, checked_resource_key,
    'succeeded', null, inserted_count, checked_synced_at, now()
  )
  on conflict (id) do update set
    root_folder_id = excluded.root_folder_id,
    root_folder_url = excluded.root_folder_url,
    root_resource_key = excluded.root_resource_key,
    sync_status = excluded.sync_status,
    sync_error = excluded.sync_error,
    item_count = excluded.item_count,
    last_synced_at = excluded.last_synced_at,
    updated_at = excluded.updated_at;

  return inserted_count;
end;
$$;

revoke all on function public.replace_library_catalog(text, text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.replace_library_catalog(text, text, text, jsonb, timestamptz) to service_role;
