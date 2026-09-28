import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import type { Profile, ProfilePhotoChange } from '../../types'
import { ProfilePhotoField } from '../profile/ProfilePhotoField'

export function TeamMemberPhotoDialog({ person, onClose, onLoadPhoto, onSave, onSaved }: {
  person: Profile
  onClose: () => void
  onLoadPhoto?: (path: string) => Promise<string>
  onSave: (person: Profile, change: File | null) => Promise<void>
  onSaved: () => void
}) {
  const [photoChange, setPhotoChange] = useState<ProfilePhotoChange>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const titleId = 'team-member-photo-title'

  async function save() {
    if (photoChange === undefined || (photoChange === null && !person.avatar_path)) return
    setSaving(true)
    setError('')
    try {
      await onSave(person, photoChange)
      onSaved()
    } catch (caught) {
      setError(errorText(caught))
      setSaving(false)
    }
  }

  return <Modal className="team-member-photo-dialog" disabled={saving} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading">
      <div><span className="eyebrow">DATOS DE PERFIL</span><h2 id={titleId}>Foto de {person.display_name}</h2></div>
      <button aria-label="Volver a datos de perfil" className="icon-button" disabled={saving} onClick={onClose} type="button">×</button>
    </div>
    <ProfilePhotoField avatarPath={person.avatar_path} editable name={person.display_name} onChange={setPhotoChange} onLoadPhoto={onLoadPhoto} photoChange={photoChange} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onClose} type="button">Volver a datos de perfil</button><button className="primary-button" disabled={saving || photoChange === undefined || (photoChange === null && !person.avatar_path)} onClick={() => void save()} type="button">{saving ? 'Guardando…' : 'Guardar foto'}</button></div>
  </Modal>
}
