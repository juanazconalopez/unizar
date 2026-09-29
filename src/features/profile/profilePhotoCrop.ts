export const PHOTO_CROP_SIZE = 260

export type PhotoCrop = {
  width: number
  height: number
  zoom: number
  offsetX: number
  offsetY: number
}

export function cropGeometry(crop: PhotoCrop) {
  const scale = Math.max(PHOTO_CROP_SIZE / crop.width, PHOTO_CROP_SIZE / crop.height) * crop.zoom
  const displayWidth = crop.width * scale
  const displayHeight = crop.height * scale
  const maxX = (displayWidth - PHOTO_CROP_SIZE) / 2
  const maxY = (displayHeight - PHOTO_CROP_SIZE) / 2
  const offsetX = Math.max(-maxX, Math.min(maxX, crop.offsetX))
  const offsetY = Math.max(-maxY, Math.min(maxY, crop.offsetY))
  return {
    displayWidth,
    displayHeight,
    maxX,
    maxY,
    offsetX,
    offsetY,
    sourceX: (maxX - offsetX) / scale,
    sourceY: (maxY - offsetY) / scale,
    sourceSize: PHOTO_CROP_SIZE / scale,
  }
}

export function initialPhotoCrop(width: number, height: number): PhotoCrop {
  const zoom = height > width * 1.3 ? 1.5 : 1
  const crop = { width, height, zoom, offsetX: 0, offsetY: 0 }
  const { maxY } = cropGeometry(crop)
  return { ...crop, offsetY: maxY * 0.7 }
}

export async function exportPhotoCrop(file: File, crop: PhotoCrop) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const source = new Image()
    source.onload = () => { URL.revokeObjectURL(url); resolve(source) }
    source.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se ha podido leer la fotografía.')) }
    source.src = url
  })
  if (image.naturalWidth !== crop.width || image.naturalHeight !== crop.height) {
    throw new Error('La fotografía ha cambiado. Selecciónala de nuevo.')
  }
  const { sourceX, sourceY, sourceSize } = cropGeometry(crop)
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Este navegador no puede recortar la fotografía.')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, 320, 320)
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 320, 320)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => {
    if (result) resolve(result)
    else reject(new Error('No se ha podido recortar la fotografía.'))
  }, 'image/jpeg', 0.9))
  return new File([blob], 'foto-perfil.jpg', { type: 'image/jpeg' })
}
