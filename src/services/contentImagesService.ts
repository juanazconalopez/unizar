import type { Tables } from '../lib/database.types'
import { contentImageIds } from '../lib/contentImageTokens'
import { supabase } from '../lib/supabase'

const BUCKET = 'content-images'
const LEGACY_CACHE_NAME = 'unizar-content-images-v1'
const CACHE_PREFIX = 'unizar-content-images-v2-'
const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_OUTPUT_BYTES = 600 * 1024
const MAX_DIMENSION = 1600
const MAX_ENTITY_IMAGES = 24
const MAX_CACHE_ITEMS = 80
const MAX_CACHE_BYTES = 50 * 1024 * 1024

export type ContentImage = Tables<'content_images'>
export type ContentImageEntityType = 'task' | 'announcement' | 'training_plan' | 'training_preset'

type PreparedImage = { blob: Blob; width: number; height: number }

const stagedImages = new Map<string, PreparedImage>()
const volatileStagedImages = new Set<string>()
const metadataCache = new Map<string, Promise<ContentImage>>()
let abandonedCleanupStarted = false
let cacheUserId: string | null | undefined
let cacheEpoch = 0

function cacheName() {
  return `${CACHE_PREFIX}${cacheUserId ?? 'demo'}`
}

function resetMemoryCache() {
  cacheEpoch += 1
  metadataCache.clear()
  stagedImages.clear()
  volatileStagedImages.clear()
  abandonedCleanupStarted = false
}

function requireCacheEpoch(epoch: number) {
  if (epoch !== cacheEpoch) throw new Error('La sesión ha cambiado durante la carga de la imagen.')
}

async function clearOtherStoredCaches() {
  if (!cacheAvailable()) return
  try {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name === LEGACY_CACHE_NAME
      || (name.startsWith(CACHE_PREFIX) && (!cacheUserId || name !== cacheName())))
      .map((name) => caches.delete(name)))
  } catch {
    // El almacenamiento es opcional; las cuentas también se separan en memoria.
  }
}

export function setContentImageCacheUser(userId: string | null) {
  if (cacheUserId === userId) return
  cacheUserId = userId
  resetMemoryCache()
  void clearOtherStoredCaches()
}

function cacheAvailable() {
  try { return typeof caches !== 'undefined' && typeof location !== 'undefined' } catch { return false }
}

function cacheRequest(id: string, state: 'pending' | 'stored') {
  return new Request(new URL(`/__content-image-cache/${state}/${id}`, location.origin).toString())
}

async function writeBlobToCache(id: string, state: 'pending' | 'stored', prepared: PreparedImage, epoch = cacheEpoch) {
  try {
    if (!cacheAvailable() || epoch !== cacheEpoch) return false
    const cache = await caches.open(cacheName())
    if (epoch !== cacheEpoch) return false
    const request = cacheRequest(id, state)
    await cache.put(request, new Response(prepared.blob, {
      headers: {
        'content-type': 'image/webp',
        'content-length': String(prepared.blob.size),
        'x-image-width': String(prepared.width),
        'x-image-height': String(prepared.height),
        'x-cached-at': String(Date.now()),
      },
    }))
    if (epoch !== cacheEpoch) {
      await cache.delete(request)
      return false
    }
    await pruneImageCache(cache)
    return true
  } catch {
    // Una caché llena o bloqueada no debe impedir pegar, mostrar ni guardar imágenes.
    return false
  }
}

async function readBlobFromCache(id: string, state: 'pending' | 'stored'): Promise<PreparedImage | null> {
  try {
    if (!cacheAvailable()) return null
    const response = await (await caches.open(cacheName())).match(cacheRequest(id, state))
    if (!response) return null
    return {
      blob: await response.blob(),
      width: Number(response.headers.get('x-image-width')) || 1,
      height: Number(response.headers.get('x-image-height')) || 1,
    }
  } catch {
    return null
  }
}

async function deleteCachedBlob(id: string, state: 'pending' | 'stored') {
  try {
    if (cacheAvailable()) await (await caches.open(cacheName())).delete(cacheRequest(id, state))
  } catch {
    // La eliminación de la imagen en memoria y en Supabase sigue adelante.
  }
}

async function pruneImageCache(cache: Cache) {
  const entries = await Promise.all((await cache.keys())
    .filter((request) => request.url.includes('/__content-image-cache/'))
    .map(async (request) => {
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

function newImageId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function stageContentImage(file: File) {
  const epoch = cacheEpoch
  const prepared = await prepareContentImage(file)
  requireCacheEpoch(epoch)
  const id = newImageId()
  stagedImages.set(id, prepared)
  const stored = await writeBlobToCache(id, 'pending', prepared, epoch)
  requireCacheEpoch(epoch)
  if (!stored) volatileStagedImages.add(id)
  return id
}

export function isStagedContentImageVolatile(id: string) {
  return volatileStagedImages.has(id)
}

export async function discardStagedContentImage(id: string) {
  stagedImages.delete(id)
  volatileStagedImages.delete(id)
  await deleteCachedBlob(id, 'pending')
}

async function loadStagedContentImage(id: string) {
  return stagedImages.get(id) ?? await readBlobFromCache(id, 'pending')
}

export async function ensureContentImages(texts: Array<string | null | undefined>, userId: string) {
  const epoch = cacheEpoch
  if (!abandonedCleanupStarted) {
    abandonedCleanupStarted = true
    await cleanupAbandonedContentImages().catch(() => undefined)
  }
  requireCacheEpoch(epoch)
  const ids = contentImageIds(texts.filter(Boolean).join('\n'))
  if (ids.length > MAX_ENTITY_IMAGES) throw new Error(`No se pueden guardar más de ${MAX_ENTITY_IMAGES} imágenes en el mismo contenido.`)
  if (!ids.length) return []

  const { data, error } = await supabase.from('content_images').select('id').in('id', ids)
  if (error) throw error
  requireCacheEpoch(epoch)
  const existing = new Set((data ?? []).map((image) => image.id))
  const uploadedIds: string[] = []

  try {
    for (const id of ids) {
      if (existing.has(id)) continue
      const prepared = await loadStagedContentImage(id)
      requireCacheEpoch(epoch)
      if (!prepared) throw new Error('Una imagen pegada ya no está disponible en este dispositivo. Quítala y vuelve a pegarla.')
      const path = `${userId}/${id}.webp`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, prepared.blob, {
        cacheControl: '31536000',
        contentType: 'image/webp',
        upsert: false,
      })
      if (uploadError) throw uploadError
      requireCacheEpoch(epoch)

      const { error: metadataError } = await supabase.from('content_images').insert({
        id,
        storage_path: path,
        mime_type: 'image/webp',
        size_bytes: prepared.blob.size,
        width: prepared.width,
        height: prepared.height,
        created_by: userId,
      })
      if (metadataError) {
        if (epoch === cacheEpoch) await supabase.storage.from(BUCKET).remove([path])
        throw metadataError
      }
      requireCacheEpoch(epoch)

      uploadedIds.push(id)
      await writeBlobToCache(id, 'stored', prepared, epoch)
      requireCacheEpoch(epoch)
      await discardStagedContentImage(id)
      metadataCache.delete(id)
    }
    return uploadedIds
  } catch (error) {
    if (epoch === cacheEpoch) await cleanupContentImages(uploadedIds)
    throw error
  }
}

export async function contentImageIdsForEntity(entityType: ContentImageEntityType, entityId: string) {
  const { data, error } = await supabase
    .from('content_image_references')
    .select('image_id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
  if (error) throw error
  return (data ?? []).map((reference) => reference.image_id)
}

export async function cleanupContentImages(ids: string[]) {
  if (!ids.length) return
  const { data, error } = await supabase.rpc('cleanup_content_images', { checked_image_ids: ids })
  if (error) throw error
  const paths = (data ?? []).map((row) => row.storage_path)
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
    if (removeError) throw removeError
  }
  const cleanedIds = paths.map((path) => path.slice(path.lastIndexOf('/') + 1).replace(/\.webp$/, ''))
  await Promise.all(cleanedIds.map(async (id) => {
    metadataCache.delete(id)
    await deleteCachedBlob(id, 'stored')
  }))
}

async function cleanupAbandonedContentImages() {
  const { data, error } = await supabase.rpc('cleanup_my_abandoned_content_images')
  if (error) throw error
  const paths = (data ?? []).map((row) => row.storage_path)
  if (!paths.length) return
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
  if (removeError) throw removeError
}

export async function loadContentImage(id: string) {
  const epoch = cacheEpoch
  let metadata = metadataCache.get(id)
  if (!metadata) {
    metadata = (async () => {
      const { data, error } = await supabase.from('content_images').select('*').eq('id', id).single()
      if (error) throw error
      return data
    })()
    metadataCache.set(id, metadata)
  }
  let image: ContentImage
  try {
    image = await metadata
  } catch (error) {
    if (metadataCache.get(id) === metadata) metadataCache.delete(id)
    throw error
  }
  requireCacheEpoch(epoch)
  const pending = stagedImages.get(id) ?? await readBlobFromCache(id, 'pending')
  requireCacheEpoch(epoch)
  if (pending) return { image, blob: pending.blob }
  const cached = await readBlobFromCache(id, 'stored')
  requireCacheEpoch(epoch)
  if (cached) return { image, blob: cached.blob }

  const { data, error } = await supabase.storage.from(BUCKET).download(image.storage_path)
  if (error) throw error
  requireCacheEpoch(epoch)
  await writeBlobToCache(id, 'stored', { blob: data, width: image.width, height: image.height }, epoch)
  requireCacheEpoch(epoch)
  return { image, blob: data }
}

export async function loadContentImageBlob(id: string) {
  const epoch = cacheEpoch
  const staged = stagedImages.get(id) ?? await readBlobFromCache(id, 'pending')
  requireCacheEpoch(epoch)
  if (staged) return staged.blob
  return (await loadContentImage(id)).blob
}

export async function clearContentImageCache() {
  resetMemoryCache()
  try {
    if (cacheAvailable()) await caches.delete(cacheName())
    await clearOtherStoredCaches()
  } catch {
    // La memoria ya está vacía; una caché bloqueada no impide cerrar sesión.
  }
}

export async function prepareContentImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Solo se pueden añadir archivos de imagen.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('La imagen original no puede superar 15 MB.')
  const source = await loadImage(file)
  if (!source.naturalWidth || !source.naturalHeight) throw new Error('No se ha podido leer la imagen.')

  let scale = Math.min(1, MAX_DIMENSION / Math.max(source.naturalWidth, source.naturalHeight))
  while (true) {
    const width = Math.max(1, Math.round(source.naturalWidth * scale))
    const height = Math.max(1, Math.round(source.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Este navegador no puede preparar imágenes.')
    context.drawImage(source, 0, 0, width, height)
    for (const quality of [0.84, 0.74, 0.64, 0.54, 0.44]) {
      const blob = await canvasBlob(canvas, quality)
      if (blob.type === 'image/webp' && blob.size <= MAX_OUTPUT_BYTES) return { blob, width, height }
    }
    if (Math.max(width, height) <= 480) break
    scale *= 0.82
  }
  throw new Error('No se ha podido reducir la imagen al tamaño permitido.')
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('El formato de la imagen no es compatible. Prueba con JPG, PNG o WebP.'))
    }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se ha podido preparar la imagen.')), 'image/webp', quality)
  })
}
