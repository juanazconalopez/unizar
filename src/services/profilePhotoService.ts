import { supabase } from '../lib/supabase'

const BUCKET = 'player-avatars'
const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_OUTPUT_BYTES = 280 * 1024
const CACHE_PREFIX = 'unizar-profile-photos-v1-'
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CACHE_ITEMS = 100
const MAX_CACHE_BYTES = 30 * 1024 * 1024

let cacheUserId: string | null = null
let cacheEpoch = 0
const photoBlobs = new Map<string, Promise<Blob>>()
const photoUrls = new Map<string, string>()
const photoDataUrls = new Map<string, Promise<string>>()

function cacheAvailable() {
  return typeof caches !== 'undefined' && typeof location !== 'undefined'
}

function cacheName(userId: string) {
  return `${CACHE_PREFIX}${userId}`
}

function cacheRequest(path: string) {
  return new Request(new URL(`/__profile-photo-cache/${encodeURIComponent(path)}`, location.origin).toString())
}

function clearMemoryCache() {
  cacheEpoch += 1
  photoBlobs.clear()
  photoDataUrls.clear()
  for (const url of photoUrls.values()) URL.revokeObjectURL(url)
  photoUrls.clear()
}

export function setProfilePhotoCacheUser(userId: string | null) {
  if (cacheUserId === userId) return
  const previousUserId = cacheUserId
  cacheUserId = userId
  clearMemoryCache()
  if (previousUserId && cacheAvailable()) void caches.delete(cacheName(previousUserId)).catch(() => undefined)
  if (!userId) void clearStoredProfilePhotoCaches()
}

async function clearStoredProfilePhotoCaches() {
  if (!cacheAvailable()) return
  try {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX))
      .map((name) => name === (cacheUserId ? cacheName(cacheUserId) : null) ? Promise.resolve(false) : caches.delete(name)))
  } catch {
    // La caché es opcional; los fallos de almacenamiento no bloquean la sesión.
  }
}

export async function clearProfilePhotoCache() {
  cacheUserId = null
  clearMemoryCache()
  await clearStoredProfilePhotoCaches()
}

async function readCachedPhoto(path: string, userId: string | null) {
  if (!userId || !cacheAvailable()) return null
  try {
    const cache = await caches.open(cacheName(userId))
    const request = cacheRequest(path)
    const response = await cache.match(request)
    if (!response) return null
    const cachedAt = Number(response.headers.get('x-cached-at'))
    if (!cachedAt || Date.now() - cachedAt > CACHE_MAX_AGE_MS) {
      await cache.delete(request)
      return null
    }
    return await response.blob()
  } catch {
    return null
  }
}

async function prunePhotoCache(cache: Cache) {
  const entries = await Promise.all((await cache.keys()).map(async (request) => {
    const response = await cache.match(request)
    return {
      request,
      bytes: Number(response?.headers.get('content-length')) || 0,
      cachedAt: Number(response?.headers.get('x-cached-at')) || 0,
    }
  }))
  entries.sort((a, b) => b.cachedAt - a.cachedAt)
  let bytes = 0
  await Promise.all(entries.map(async (entry, index) => {
    bytes += entry.bytes
    if (index >= MAX_CACHE_ITEMS || bytes > MAX_CACHE_BYTES) await cache.delete(entry.request)
  }))
}

async function writeCachedPhoto(path: string, blob: Blob, userId: string | null, epoch: number) {
  if (!userId || !cacheAvailable() || epoch !== cacheEpoch) return
  try {
    const cache = await caches.open(cacheName(userId))
    if (epoch !== cacheEpoch) return
    const request = cacheRequest(path)
    await cache.put(request, new Response(blob, {
      headers: { 'content-type': 'image/jpeg', 'content-length': String(blob.size), 'x-cached-at': String(Date.now()) },
    }))
    if (epoch !== cacheEpoch) {
      await cache.delete(request)
      return
    }
    await prunePhotoCache(cache)
  } catch {
    // Si el navegador no admite Cache Storage o no queda espacio, se usa la memoria.
  }
}

async function loadProfilePhotoBlob(path: string) {
  const existing = photoBlobs.get(path)
  if (existing) return existing
  const userId = cacheUserId
  const epoch = cacheEpoch
  const pending = (async () => {
    const cached = await readCachedPhoto(path, userId)
    if (epoch !== cacheEpoch) throw new Error('La sesión ha cambiado durante la carga de la fotografía.')
    if (cached) return cached
    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (error) throw error
    if (epoch !== cacheEpoch) throw new Error('La sesión ha cambiado durante la carga de la fotografía.')
    await writeCachedPhoto(path, data, userId, epoch)
    return data
  })()
  photoBlobs.set(path, pending)
  try {
    return await pending
  } catch (error) {
    if (photoBlobs.get(path) === pending) photoBlobs.delete(path)
    throw error
  }
}

export async function loadProfilePhotoUrl(path: string) {
  const existing = photoUrls.get(path)
  if (existing) return existing
  const epoch = cacheEpoch
  const blob = await loadProfilePhotoBlob(path)
  if (epoch !== cacheEpoch) throw new Error('La sesión ha cambiado durante la carga de la fotografía.')
  const loaded = photoUrls.get(path)
  if (loaded) return loaded
  const url = URL.createObjectURL(blob)
  photoUrls.set(path, url)
  return url
}

export async function loadProfilePhotoDataUrl(path: string) {
  const existing = photoDataUrls.get(path)
  if (existing) return existing
  const epoch = cacheEpoch
  const pending = (async () => {
    const blob = await loadProfilePhotoBlob(path)
    if (epoch !== cacheEpoch) throw new Error('La sesión ha cambiado durante la carga de la fotografía.')
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => epoch === cacheEpoch && typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('No se ha podido leer la fotografía.'))
      reader.onerror = () => reject(new Error('No se ha podido leer la fotografía.'))
      reader.readAsDataURL(blob)
    })
  })()
  photoDataUrls.set(path, pending)
  try {
    return await pending
  } catch (error) {
    if (photoDataUrls.get(path) === pending) photoDataUrls.delete(path)
    throw error
  }
}

export async function uploadProfilePhoto(profileId: string, file: File) {
  const photo = await prepareProfilePhoto(file)
  const uniquePart = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `${profileId}/${uniquePart}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, photo, {
    cacheControl: '3600',
    contentType: 'image/jpeg',
  })
  if (error) throw error
  photoBlobs.set(path, Promise.resolve(photo))
  await writeCachedPhoto(path, photo, cacheUserId, cacheEpoch)
  return path
}

export async function deleteProfilePhoto(path: string | null) {
  if (!path) return
  photoBlobs.delete(path)
  photoDataUrls.delete(path)
  const url = photoUrls.get(path)
  if (url) URL.revokeObjectURL(url)
  photoUrls.delete(path)
  if (cacheUserId && cacheAvailable()) {
    try { await (await caches.open(cacheName(cacheUserId))).delete(cacheRequest(path)) } catch { /* La eliminación remota sigue adelante. */ }
  }
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export async function prepareProfilePhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('La fotografía original no puede superar 12 MB.')

  const source = await loadImage(file)
  const side = Math.min(source.naturalWidth, source.naturalHeight)
  if (!side) throw new Error('No se ha podido leer la fotografía.')
  const sourceX = (source.naturalWidth - side) / 2
  const sourceY = (source.naturalHeight - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Este navegador no puede preparar la fotografía.')
  context.drawImage(source, sourceX, sourceY, side, side, 0, 0, 320, 320)

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const blob = await canvasBlob(canvas, quality)
    if (blob.size <= MAX_OUTPUT_BYTES) return blob
  }
  throw new Error('No se ha podido reducir la fotografía al tamaño permitido.')
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('El formato de la fotografía no es compatible. Prueba con JPG, PNG o WebP.'))
    }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se ha podido preparar la fotografía.'))
    }, 'image/jpeg', quality)
  })
}
