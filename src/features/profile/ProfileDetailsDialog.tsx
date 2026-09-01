import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { ageOnDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { ProfileDetailsValues } from '../../types'

export function ProfileDetailsDialog({ currentName, email, currentPhone = '', currentBirthDate = '', eyebrow = 'MI PERFIL', highlightMissing = false, helpText, title = 'Datos de perfil', onClose, onSave }: {
  currentName: string
  email: string
  currentPhone?: string
  currentBirthDate?: string
  eyebrow?: string
  highlightMissing?: boolean
  helpText?: string
  title?: string
  onClose: () => void
  onSave: (values: ProfileDetailsValues) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(currentName)
  const [phone, setPhone] = useState(currentPhone)
  const [birthDate, setBirthDate] = useState(currentBirthDate)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const titleId = 'profile-details-dialog-title'
  const changed = displayName.trim() !== currentName.trim()
    || phone.trim() !== currentPhone.trim()
    || birthDate !== currentBirthDate
  const age = ageOnDate(birthDate, todayIso())

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = displayName.trim().replace(/\s+/g, ' ')
    const normalizedPhone = phone.trim()
    if (normalizedName.length < 3 || normalizedName.length > 80 || !/^\S+\s+\S+/.test(normalizedName)) {
      setFormError('Escribe tu nombre y al menos un apellido (entre 3 y 80 caracteres).')
      return
    }
    if (normalizedPhone && (normalizedPhone.length < 6 || normalizedPhone.length > 30)) {
      setFormError('Escribe un teléfono válido (entre 6 y 30 caracteres).')
      return
    }
    if (birthDate && birthDate > todayIso()) {
      setFormError('La fecha de nacimiento no puede estar en el futuro.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      await onSave({ displayName: normalizedName, phone: normalizedPhone, birthDate })
      onClose()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  return (
    <Modal className="profile-details-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={submit}>
      <div className="task-detail-heading">
        <div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2></div>
        <button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button>
      </div>
      <p className="profile-details-help">{helpText ?? 'El email pertenece a tu cuenta de Google. El teléfono y la fecha de nacimiento solo se utilizan para la gestión del equipo.'}</p>
      <div className="profile-details-fields">
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
        <label>Email de Google
          <input className="readonly-field" readOnly type="email" value={email} />
        </label>
        <label className={highlightMissing && !phone.trim() ? 'profile-field-missing' : undefined}>Teléfono
          <input
            autoComplete="tel"
            inputMode="tel"
            maxLength={30}
            name="phone"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Ej. +34 600 000 000"
            type="tel"
            value={phone}
          />
          {highlightMissing && !phone.trim() && <small className="profile-missing-help">Falta completar este dato.</small>}
        </label>
        <label className={highlightMissing && !birthDate ? 'profile-field-missing' : undefined}>Fecha de nacimiento
          <input max={todayIso()} name="birthDate" onChange={(event) => setBirthDate(event.target.value)} type="date" value={birthDate} />
          {highlightMissing && !birthDate && <small className="profile-missing-help">Falta completar este dato.</small>}
          {age !== null && <small className="profile-age-preview">Edad actual: {age} años.</small>}
        </label>
      </div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="form-actions">
        <button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancelar</button>
        <button className="primary-button" disabled={saving || !changed}>{saving ? 'Guardando…' : 'Guardar datos'}</button>
      </div>
    </Modal>
  )
}
