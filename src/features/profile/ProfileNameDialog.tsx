import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'

export function ProfileNameDialog({ currentName, onClose, onSave }: {
  currentName: string
  onClose: () => void
  onSave: (displayName: string) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const titleId = 'profile-name-dialog-title'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = displayName.trim().replace(/\s+/g, ' ')
    if (normalizedName.length < 3 || normalizedName.length > 80 || !/^\S+\s+\S+/.test(normalizedName)) {
      setFormError('Escribe tu nombre y al menos un apellido (entre 3 y 80 caracteres).')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      await onSave(normalizedName)
      onClose()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  return (
    <Modal className="profile-name-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={submit}>
      <div className="task-detail-heading">
        <div><span className="eyebrow">MI PERFIL</span><h2 id={titleId}>Editar mi nombre</h2></div>
        <button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button>
      </div>
      <p className="profile-name-help">Este nombre se utilizará dentro de CDU Rugby y no modificará tu cuenta de Google.</p>
      <label>Nombre y apellidos
        <input
          autoComplete="name"
          autoFocus
          maxLength={80}
          name="displayName"
          onChange={(event) => setDisplayName(event.target.value)}
          required
          value={displayName}
        />
      </label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="form-actions">
        <button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancelar</button>
        <button className="primary-button" disabled={saving || displayName.trim() === currentName.trim()}>{saving ? 'Guardando…' : 'Guardar nombre'}</button>
      </div>
    </Modal>
  )
}
