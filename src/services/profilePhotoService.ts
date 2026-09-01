import { supabase } from '../lib/supabase'

const BUCKET = 'player-avatars'
const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_OUTPUT_BYTES = 280 * 1024
const photoUrlCache = new Map<string, { url: string; expiresAt: number }>()

export async function loadProfilePhotoUrl(path: string) {
  const cached = photoUrlCache.get(path)
  if (cached && cached.expiresAt > Date.now()) return cached.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  photoUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 })
  return data.signedUrl
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
  return path
}

export async function deleteProfilePhoto(path: string | null) {
  if (!path) return
  photoUrlCache.delete(path)
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
