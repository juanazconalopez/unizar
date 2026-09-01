import { useEffect, useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { errorText } from '../../lib/errors'
import type { ProfilePhotoChange } from '../../types'

export function ProfilePhotoField({ name, avatarPath, photoChange, editable = false, onChange, onLoadPhoto }: {
  name: string
  avatarPath: string | null
  photoChange?: ProfilePhotoChange
  editable?: boolean
  onChange?: (change: ProfilePhotoChange) => void
  onLoadPhoto?: (path: string) => Promise<string>
}) {
  const [storedUrl, setStoredUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!avatarPath || !onLoadPhoto) return
    let cancelled = false
    void onLoadPhoto(avatarPath).then((url) => {
      if (!cancelled) setStoredUrl(url)
    }).catch((error) => {
      if (!cancelled) setLoadError(errorText(error))
    })
    return () => { cancelled = true }
  }, [avatarPath, onLoadPhoto])

  useEffect(() => {
    if (!(photoChange instanceof File)) return
    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => setLoadError('No se ha podido previsualizar la fotografía.')
    reader.readAsDataURL(photoChange)
    return () => {
      if (reader.readyState === FileReader.LOADING) reader.abort()
    }
  }, [photoChange])

  const imageUrl = photoChange === null
    ? null
    : photoChange instanceof File
      ? previewUrl
      : avatarPath ? storedUrl : null
  return <div className={`profile-photo-field${editable ? ' editable' : ''}`}>
    <div className="profile-photo-preview">
      {imageUrl
        ? <img alt={`Fotografía de ${name}`} onError={() => setStoredUrl(null)} src={imageUrl} />
        : <Avatar name={name} />}
    </div>
    <div className="profile-photo-copy">
      <strong>Fotografía de perfil</strong>
      <span>{editable ? 'Se recortará y comprimirá antes de guardarse.' : imageUrl ? 'Visible únicamente dentro de Datos de perfil.' : 'Esta jugadora todavía no ha añadido fotografía.'}</span>
      {loadError && <small>{loadError}</small>}
      {editable && onChange && <div className="profile-photo-actions">
        <label className="secondary-button compact">{imageUrl ? 'Cambiar foto' : 'Añadir foto'}
          <input accept="image/*" aria-label="Seleccionar fotografía" onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onChange(file)
            event.target.value = ''
          }} type="file" />
        </label>
        {imageUrl && <button className="text-button danger-text" onClick={() => onChange(null)} type="button">Eliminar foto</button>}
      </div>}
    </div>
  </div>
}
