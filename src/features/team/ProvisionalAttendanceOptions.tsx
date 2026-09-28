import { formatDate } from '../../lib/dates'
import { areDisplayNamesSimilar } from '../../lib/displayNames'
import type { Profile, ProvisionalAttendanceRecord, ProvisionalPlayer } from '../../types'

export function ProvisionalAttendanceOptions({ person, candidates, attendance, selectedIds, onSelectionChange, className = '' }: {
  person: Profile
  candidates: ProvisionalPlayer[]
  attendance: ProvisionalAttendanceRecord[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  className?: string
}) {
  const selectedDates = attendance.filter((record) => selectedIds.includes(record.provisional_player_id))
    .flatMap((record) => record.training_sessions?.session_date ? [record.training_sessions.session_date] : []).sort()

  function toggle(guestId: string) {
    onSelectionChange(selectedIds.includes(guestId) ? selectedIds.filter((id) => id !== guestId) : [...selectedIds, guestId])
  }

  return <>
    <fieldset className={`provisional-link-options ${className}`.trim()}><legend>Invitadas</legend>
      {candidates.map((guest) => {
        const count = attendance.filter((record) => record.provisional_player_id === guest.id).length
        const suggested = areDisplayNamesSimilar(guest.display_name, person.display_name)
        return <label key={guest.id}><input checked={selectedIds.includes(guest.id)} onChange={() => toggle(guest.id)} type="checkbox" /><span>{guest.display_name}</span><small>{count} {count === 1 ? 'asistencia' : 'asistencias'}{suggested ? ' · sugerida' : ''}</small></label>
      })}
    </fieldset>
    {selectedDates.length > 0 && <small className="provisional-link-history">Historial desde {formatDate(selectedDates[0], { day: 'numeric', month: 'short', year: 'numeric' })}{selectedDates.length > 1 ? ` hasta ${formatDate(selectedDates.at(-1)!, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.</small>}
  </>
}
