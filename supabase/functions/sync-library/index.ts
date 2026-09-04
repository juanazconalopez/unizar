import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const MAX_ITEMS = 10000
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ServiceAccount = {
  client_email?: string
  private_key?: string
}

type DriveFile = {
  id?: string
  name?: string
  mimeType?: string
  parents?: string[]
  size?: string
  modifiedTime?: string
  webViewLink?: string
  webContentLink?: string
  resourceKey?: string
}

type LibraryItemPayload = {
  drive_file_id: string
  parent_drive_id: string
  name: string
  mime_type: string
  size_bytes: string | null
  modified_at: string | null
  web_view_link: string | null
  web_content_link: string | null
  resource_key: string | null
  is_folder: boolean
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  let admin: ReturnType<typeof createClient> | undefined
  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const anonKey = requiredEnv('SUPABASE_ANON_KEY')
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Sesión no válida.' }, 401)

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('is_owner, is_approved, is_active, is_archived')
      .eq('id', user.id)
      .single()
    if (profileError) throw profileError
    if (!profile?.is_owner || !profile.is_approved || !profile.is_active || profile.is_archived) {
      return json({ error: 'Solo un owner activo puede sincronizar la librería.' }, 403)
    }

    admin = createClient(supabaseUrl, serviceKey)
    const { data: settings, error: settingsError } = await admin
      .from('library_settings')
      .select('root_folder_id, root_folder_url, root_resource_key')
      .eq('id', true)
      .maybeSingle()
    if (settingsError) throw settingsError
    if (!settings?.root_folder_id) return json({ error: 'Configura primero una carpeta de Google Drive.' }, 400)

    await admin.from('library_settings').update({
      sync_status: 'running',
      sync_error: null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq('id', true)

    const googleCredentials = readServiceAccount()
    const accessToken = await getDriveAccessToken(googleCredentials)
    const items = await collectDriveItems(accessToken, settings.root_folder_id, settings.root_resource_key ?? undefined)
    const syncedAt = new Date().toISOString()
    const { data: count, error: replaceError } = await admin.rpc('replace_library_catalog', {
      checked_folder_id: settings.root_folder_id,
      checked_folder_url: settings.root_folder_url,
      checked_resource_key: settings.root_resource_key,
      checked_items: items,
      checked_synced_at: syncedAt,
    })
    if (replaceError) throw replaceError

    return json({ itemCount: typeof count === 'number' ? count : items.length, syncedAt })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar la librería.'
    if (admin) {
      await admin.from('library_settings').update({
        sync_status: 'failed',
        sync_error: message,
        updated_at: new Date().toISOString(),
      }).eq('id', true)
    }
    return json({ error: message }, 500)
  }
})

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta el secreto ${name}.`)
  return value
}

function readServiceAccount(): Required<ServiceAccount> {
  const raw = requiredEnv('GOOGLE_SERVICE_ACCOUNT_JSON')
  let parsed: ServiceAccount
  try {
    parsed = JSON.parse(raw) as ServiceAccount
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no contiene un JSON válido.')
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('La credencial de Google no contiene client_email o private_key.')
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key }
}

async function getDriveAccessToken(credentials: Required<ServiceAccount>) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const assertion = await signJwt({
    iss: credentials.client_email,
    scope: DRIVE_METADATA_SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }, credentials.private_key)
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const body = await response.json().catch(() => null) as { access_token?: string; error_description?: string } | null
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error_description || `Google OAuth ha respondido con ${response.status}.`)
  }
  return body.access_token
}

async function signJwt(payload: Record<string, string | number>, privateKey: string) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data)
  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function collectDriveItems(accessToken: string, rootFolderId: string, rootResourceKey?: string) {
  const queue: Array<{ id: string; resourceKey?: string }> = [{ id: rootFolderId, resourceKey: rootResourceKey }]
  const visited = new Set<string>()
  const items: LibraryItemPayload[] = []
  while (queue.length) {
    const parent = queue.shift()!
    if (visited.has(parent.id)) continue
    visited.add(parent.id)
    const children = await listDriveChildren(accessToken, parent.id, parent.resourceKey)
    for (const file of children) {
      if (!file.id || !file.name || !file.mimeType) continue
      if (items.length >= MAX_ITEMS) throw new Error(`La carpeta supera el límite de ${MAX_ITEMS} elementos.`)
      const isFolder = file.mimeType === DRIVE_FOLDER_MIME
      const child: LibraryItemPayload = {
        drive_file_id: file.id,
        parent_drive_id: file.parents?.[0] ?? parent.id,
        name: file.name,
        mime_type: file.mimeType,
        size_bytes: file.size ?? null,
        modified_at: file.modifiedTime ?? null,
        web_view_link: file.webViewLink ?? null,
        web_content_link: file.webContentLink ?? null,
        resource_key: file.resourceKey ?? null,
        is_folder: isFolder,
      }
      items.push(child)
      if (isFolder) queue.push({ id: file.id, resourceKey: file.resourceKey })
    }
  }
  return items
}

async function listDriveChildren(accessToken: string, parentId: string, resourceKey?: string) {
  const files: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${parentId.replaceAll("'", "\\'")}' in parents and trashed = false`,
      spaces: 'drive',
      pageSize: '1000',
      fields: 'nextPageToken,files(id,name,mimeType,parents,size,modifiedTime,webViewLink,webContentLink,resourceKey)',
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }
    if (resourceKey) headers['X-Goog-Drive-Resource-Keys'] = `${parentId}/${resourceKey}`
    const response = await fetch(`${DRIVE_FILES_URL}?${params}`, { headers })
    const body = await response.json().catch(() => null) as { files?: DriveFile[]; nextPageToken?: string; error?: { message?: string } } | null
    if (!response.ok) throw new Error(body?.error?.message || `Google Drive ha respondido con ${response.status}.`)
    files.push(...(body?.files ?? []))
    pageToken = body?.nextPageToken
  } while (pageToken)
  return files
}

function pemToBytes(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
