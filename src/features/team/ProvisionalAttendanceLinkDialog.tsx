import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import type { Profile, ProvisionalAttendanceRecord, ProvisionalPlayer } from '../../types'
import { ProvisionalAttendanceOptions } from './ProvisionalAttendanceOptions'

export function ProvisionalAttendanceLinkDialog({ person, candidates, attendance, selectedIds, onSelectionChange, onClose, onLink, onLinked }: {
  person: Profile
  candidates: ProvisionalPlayer[]
  attendance: ProvisionalAttendanceRecord[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onClose: () => void
  onLink?: (guests: ProvisionalPlayer[], profile: Profile) => Promise<void>
  onLinked: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedGuests = candidates.filter((guest) => selectedIds.includes(guest.id))
  const selectedDates = attendance.filter((record) => selectedIds.includes(record.provisional_player_id))
    .flatMap((record) => record.training_sessions?.session_date ? [record.training_sessions.session_date] : []).sort()
  const titleId = 'provisional-attendance-dialog-title'

  async function link() {
    if (!onLink || selectedGuests.length === 0 || selectedDates.length === 0) return
    const count = selectedGuests.length
    const total = selectedDates.length
    if (!window.confirm(`¿Vincular ${count} ${count === 1 ? 'invitada' : 'invitadas'} (${total} ${total === 1 ? 'asistencia' : 'asistencias'}) con ${person.display_name}?`)) return
    setSaving(true)
    setError('')
    try {
      await onLink(selectedGuests, person)
      onLinked()
    } catch (cause) {
      setError(errorText(cause))
      setSaving(false)
    }
  }

  return <Modal className="team-action-dialog" disabled={saving} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading">
      <div><span className="eyebrow">ASISTENCIAS PENDIENTES</span><h2 id={titleId}>Vincular asistencias de {person.display_name}</h2></div>
      <button aria-label="Cerrar vinculación de asistencias" className="icon-button" disabled={saving} onClick={onClose} type="button">×</button>
    </div>
    <p className="team-action-intro">Selecciona manualmente todas las identidades que correspondan. Las sugerencias no se vinculan automáticamente.</p>
    <ProvisionalAttendanceOptions attendance={attendance} candidates={candidates} className="team-action-options" onSelectionChange={onSelectionChange} person={person} selectedIds={selectedIds} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onClose} type="button">Volver a datos de perfil</button>{person.is_player && onLink && <button className="primary-button" disabled={saving || selectedGuests.length === 0 || selectedDates.length === 0} onClick={() => void link()} type="button">{saving ? 'Vinculando…' : 'Vincular asistencias'}</button>}</div>
  </Modal>
}
