import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { formatDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { PlayerAbsence, PlayerAbsencePrivateNote, Profile } from '../../types'
import type { PlayerAbsenceValues } from '../../services/playerAbsencesService'
import { getCurrentPlayerAbsence } from './playerAbsenceStatus'

export function PlayerAbsenceDialog({ person, absences, editAbsenceId, notes = [], onClose, onSave, onDelete, onDischarge }: {
  person: Profile
  absences: PlayerAbsence[]
  editAbsenceId?: string
  notes?: PlayerAbsencePrivateNote[]
  onClose: () => void
  onSave: (player: Profile, values: PlayerAbsenceValues, absenceId?: string) => Promise<void>
  onDelete?: (absenceId: string) => Promise<void>
  onDischarge?: (absenceId: string) => Promise<void>
}) {
  const initialEditingAbsence = absences.find((absence) => absence.id === editAbsenceId) ?? null
  const [startsOn, setStartsOn] = useState(initialEditingAbsence?.starts_on ?? todayIso())
  const [endsOn, setEndsOn] = useState(initialEditingAbsence?.ends_on ?? '')
  const [privateNote, setPrivateNote] = useState(initialEditingAbsence ? notes.find((item) => item.absence_id === initialEditingAbsence.id)?.note ?? '' : '')
  const [editingAbsence, setEditingAbsence] = useState<PlayerAbsence | null>(initialEditingAbsence)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const today = todayIso()
  const currentAbsence = getCurrentPlayerAbsence(absences, person.id, today)
  const titleId = 'player-absence-dialog-title'

  function edit(absence: PlayerAbsence) {
    setEditingAbsence(absence)
    setStartsOn(absence.starts_on)
    setEndsOn(absence.ends_on ?? '')
    setPrivateNote(notes.find((item) => item.absence_id === absence.id)?.note ?? '')
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (endsOn && endsOn < startsOn) return setError('La fecha de finalización no puede ser anterior al inicio.')
    setSaving(true)
    setError('')
    try {
      await onSave(person, { startsOn, endsOn, privateNote }, editingAbsence?.id)
      onClose()
    } catch (cause) {
      setError(errorText(cause))
      setSaving(false)
    }
  }

  async function remove(absenceId: string) {
    if (!onDelete) return
    setSaving(true)
    setError('')
    try {
      await onDelete(absenceId)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setSaving(false)
    }
  }

  async function discharge(absence: PlayerAbsence) {
    if (!onDischarge || !window.confirm('¿Dar de alta hoy a ' + person.display_name + '? Podrá volver a estar disponible desde hoy.')) return
    setSaving(true)
    setError('')
    try {
      await onDischarge(absence.id)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setSaving(false)
    }
  }

  function absenceStatus(absence: PlayerAbsence) {
    if (absence.discharged_on) return 'Alta deportiva: ' + formatDate(absence.discharged_on, { day: 'numeric', month: 'short', year: 'numeric' })
    if (absence === currentAbsence) return 'Vigente'
    return absence.starts_on > today ? 'Programada' : 'Finalizada'
  }

  return <Modal className="team-action-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={save}>
    <div className="task-detail-heading">
      <div><span className="eyebrow">BAJAS</span><h2 id={titleId}>Baja deportiva de {person.display_name}</h2></div>
      <button aria-label="Cerrar baja deportiva" className="icon-button" disabled={saving} onClick={onClose} type="button">×</button>
    </div>
    <p className="team-action-intro">Durante una baja no podrá apuntarse, ser convocada ni contar en asistencia deportiva. Las tareas siguen siendo opcionales.</p>
    {!editingAbsence && absences.length > 0 && <section className="team-action-history" aria-label="Bajas registradas">
      {absences.map((absence) => <div className="absence-row" key={absence.id}>
        <div className="absence-row-details">
          <span>{formatDate(absence.starts_on, { day: 'numeric', month: 'short', year: 'numeric' })} — {absence.ends_on ? formatDate(absence.ends_on, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha prevista'}</span>
          <small>{absenceStatus(absence)}</small>
        </div>
        <div className="absence-row-actions">
          <button className="text-button" disabled={saving} onClick={() => edit(absence)} type="button">Editar</button>
          {absence === currentAbsence && !absence.discharged_on && onDischarge && <button className="text-button" disabled={saving} onClick={() => void discharge(absence)} type="button">Dar de alta hoy</button>}
          {onDelete && <button className="text-button danger" disabled={saving} onClick={() => void remove(absence.id)} type="button">Eliminar</button>}
        </div>
      </div>)}
    </section>}
    <div className="profile-details-fields team-action-fields">
      <label>Inicio<input disabled={Boolean(editingAbsence)} onChange={(event) => setStartsOn(event.target.value)} required type="date" value={startsOn} /></label>
      <label>Fin previsto<input min={startsOn} onChange={(event) => setEndsOn(event.target.value)} type="date" value={endsOn} /></label>
      <label className="full-field">Nota privada opcional<textarea maxLength={1000} onChange={(event) => setPrivateNote(event.target.value)} placeholder="Solo visible para owner" rows={2} spellCheck value={privateNote} /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">
      <button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancelar</button>
      <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : editingAbsence ? 'Guardar cambios' : 'Registrar baja'}</button>
    </div>
  </Modal>
}
