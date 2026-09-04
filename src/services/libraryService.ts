import { supabase } from '../lib/supabase'
import type { LibraryItem, LibrarySettings } from '../types'

const libraryItemSelect = 'drive_file_id, parent_drive_id, name, mime_type, size_bytes, modified_at, web_view_link, web_content_link, resource_key, is_folder, synced_at'
const librarySettingsSelect = 'id, root_folder_id, root_folder_url, root_resource_key, sync_status, sync_error, item_count, last_synced_at, updated_at, updated_by'

export async function fetchLibraryItems(): Promise<LibraryItem[]> {
  const { data, error } = await supabase
    .from('library_items')
    .select(libraryItemSelect)
    .order('parent_drive_id', { ascending: true, nullsFirst: true })
    .order('is_folder', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as LibraryItem[]
}

export async function fetchLibrarySettings(): Promise<LibrarySettings | null> {
  const { data, error } = await supabase
    .from('library_settings')
    .select(librarySettingsSelect)
    .eq('id', true)
    .maybeSingle()
  if (error) throw error
  return data as LibrarySettings | null
}

export async function saveLibraryFolder(folderUrl: string) {
  const parsed = parseDriveFolder(folderUrl)
  if (!parsed) throw new Error('Introduce un enlace válido de una carpeta de Google Drive.')
  const { error } = await supabase.rpc('set_library_folder', {
    checked_folder_id: parsed.id,
    checked_folder_url: folderUrl.trim(),
    checked_resource_key: parsed.resourceKey,
  })
  if (error) throw error
  return fetchLibrarySettings()
}

export async function syncLibrary() {
  const { data, error } = await supabase.functions.invoke('sync-library', { body: {} })
  if (error) {
    const context = 'context' in error ? error.context : null
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null) as { error?: string } | null
      if (body?.error) throw new Error(body.error)
    }
    throw error
  }
  return data as { itemCount: number; syncedAt: string }
}

export function parseDriveFolder(value: string): { id: string; resourceKey: string | null } | null {
  const input = value.trim()
  if (!input) return null
  const folderMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  const id = folderMatch?.[1] ?? (input.match(/^[a-zA-Z0-9_-]{10,}$/)?.[0] ?? null)
  if (!id) return null
  let resourceKey: string | null = null
  try {
    resourceKey = new URL(input).searchParams.get('resourcekey')
  } catch {
    // A raw folder ID has no resource key.
  }
  return { id, resourceKey }
}
