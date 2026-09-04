-- Corrección para Supabase/pg_safeupdate:
-- al cambiar la carpeta se vacía el catálogo, pero el DELETE debe incluir WHERE.
-- Ejecutar este script una vez si 037_library.sql ya se aplicó.

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
