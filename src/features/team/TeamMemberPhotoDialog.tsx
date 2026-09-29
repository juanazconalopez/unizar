import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import type { Profile, ProfilePhotoChange } from '../../types'
import { ProfilePhotoCropEditor } from '../profile/ProfilePhotoCropEditor'
import { ProfilePhotoField } from '../profile/ProfilePhotoField'
import { exportPhotoCrop } from '../profile/profilePhotoCrop'
import type { PhotoCrop } from '../profile/profilePhotoCrop'

export function TeamMemberPhotoDialog({ person, onClose, onLoadPhoto, onSave, onSaved }: {
  person: Profile
  onClose: () => void
  onLoadPhoto?: (path: string) => Promise<string>
  onSave: (person: Profile, change: File | null) => Promise<void>
  onSaved: () => void
}) {
  const [photoChange, setPhotoChange] = useState<ProfilePhotoChange>(undefined)
  const [crop, setCrop] = useState<PhotoCrop | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingCurrent, setLoadingCurrent] = useState(false)
  const [error, setError] = useState('')
  const titleId = 'team-member-photo-title'

  async function save() {
    if (photoChange === undefined || (photoChange === null && !person.avatar_path) || (photoChange instanceof File && !crop)) return
    setSaving(true)
    setError('')
    try {
      const prepared = photoChange instanceof File && crop ? await exportPhotoCrop(photoChange, crop) : photoChange
      await onSave(person, prepared)
      onSaved()
    } catch (caught) {
      setError(errorText(caught))
      setSaving(false)
    }
  }

  async function editCurrentPhoto() {
    if (!person.avatar_path || !onLoadPhoto) return
    setLoadingCurrent(true)
    setError('')
    try {
      const url = await onLoadPhoto(person.avatar_path)
      const response = await fetch(url)
      if (!response.ok) throw new Error('No se ha podido leer la fotografía actual.')
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('La fotografía actual no tiene un formato de imagen compatible.')
      setPhotoChange(new File([blob], 'foto-actual', { type: blob.type }))
      setCrop(null)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setLoadingCurrent(false)
    }
  }

  return <Modal className="team-member-photo-dialog" disabled={saving || loadingCurrent} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading">
      <div><span className="eyebrow">DATOS DE PERFIL</span><h2 id={titleId}>Foto de {person.display_name}</h2></div>
      <button aria-label="Volver a datos de perfil" className="icon-button" disabled={saving} onClick={onClose} type="button">×</button>
    </div>
    <ProfilePhotoField avatarPath={person.avatar_path} editable name={person.display_name} onChange={(change) => {
      if (change instanceof File && (!change.type.startsWith('image/') || change.size > 12 * 1024 * 1024)) {
        setPhotoChange(undefined)
        setCrop(null)
        setError(change.size > 12 * 1024 * 1024 ? 'La fotografía original no puede superar 12 MB.' : 'Selecciona un archivo de imagen.')
        return
      }
      setError('')
      setPhotoChange(change)
      setCrop(null)
    }} onLoadPhoto={onLoadPhoto} photoChange={photoChange} />
    {person.avatar_path && onLoadPhoto && photoChange === undefined && <button className="secondary-button compact profile-photo-edit-current" disabled={loadingCurrent} onClick={() => void editCurrentPhoto()} type="button">{loadingCurrent ? 'Cargando foto…' : 'Ajustar foto actual'}</button>}
    {photoChange instanceof File && <ProfilePhotoCropEditor file={photoChange} onChange={setCrop} onLoadError={() => setError('El formato de la fotografía no es compatible. Prueba con JPG, PNG o WebP.')} />}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onClose} type="button">Volver a datos de perfil</button><button className="primary-button" disabled={saving || photoChange === undefined || (photoChange === null && !person.avatar_path) || (photoChange instanceof File && !crop)} onClick={() => void save()} type="button">{saving ? 'Guardando…' : 'Guardar foto'}</button></div>
  </Modal>
}
