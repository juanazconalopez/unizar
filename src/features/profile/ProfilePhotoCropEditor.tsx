import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { cropGeometry, initialPhotoCrop, PHOTO_CROP_SIZE } from './profilePhotoCrop'
import type { PhotoCrop } from './profilePhotoCrop'

export function ProfilePhotoCropEditor({ file, onChange, onLoadError }: {
  file: File
  onChange: (crop: PhotoCrop | null) => void
  onLoadError?: () => void
}) {
  const [imageUrl, setImageUrl] = useState('')
  const [crop, setCrop] = useState<PhotoCrop | null>(null)
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const onLoadErrorRef = useRef(onLoadError)
  useEffect(() => { onLoadErrorRef.current = onLoadError }, [onLoadError])

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => {
      setCrop(null)
      onChange(null)
      setImageUrl(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => onLoadErrorRef.current?.()
    reader.readAsDataURL(file)
    return () => { if (reader.readyState === FileReader.LOADING) reader.abort() }
  }, [file, onChange])

  function update(next: PhotoCrop) {
    const geometry = cropGeometry(next)
    const clamped = { ...next, offsetX: geometry.offsetX, offsetY: geometry.offsetY }
    setCrop(clamped)
    onChange(clamped)
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!crop) return
    drag.current = { x: event.clientX, y: event.clientY, offsetX: crop.offsetX, offsetY: crop.offsetY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!crop || !drag.current) return
    update({ ...crop, offsetX: drag.current.offsetX + event.clientX - drag.current.x, offsetY: drag.current.offsetY + event.clientY - drag.current.y })
  }

  const geometry = crop ? cropGeometry(crop) : null
  return <div className="profile-photo-crop">
    <strong>Encuadra la fotografía</strong>
    <p>Arrastra la imagen y ajusta el zoom para que el rostro quede dentro del círculo.</p>
    <div aria-label="Mover fotografía para encuadrarla" className="profile-photo-crop-stage" onKeyDown={(event) => {
      if (!crop || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      const distance = event.shiftKey ? 20 : 5
      update({ ...crop, offsetX: crop.offsetX + (event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0), offsetY: crop.offsetY + (event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0) })
    }} onPointerCancel={() => { drag.current = null }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null }} role="group" tabIndex={0}>
      {imageUrl && <img alt="Vista previa del encuadre" onError={onLoadError} onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget
        if (naturalWidth && naturalHeight) update(initialPhotoCrop(naturalWidth, naturalHeight))
      }} src={imageUrl} style={geometry ? {
        width: geometry.displayWidth,
        height: geometry.displayHeight,
        left: (PHOTO_CROP_SIZE - geometry.displayWidth) / 2 + geometry.offsetX,
        top: (PHOTO_CROP_SIZE - geometry.displayHeight) / 2 + geometry.offsetY,
      } : undefined} />}
      <span aria-hidden="true" className="profile-photo-crop-guide" />
    </div>
    <label className="profile-photo-crop-zoom">Zoom
      <input aria-label="Zoom de la fotografía" disabled={!crop} max="3" min="1" onChange={(event) => crop && update({ ...crop, zoom: Number(event.target.value) })} step="0.05" type="range" value={crop?.zoom ?? 1} />
    </label>
  </div>
}
