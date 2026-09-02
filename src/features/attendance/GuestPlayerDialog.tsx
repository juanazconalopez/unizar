import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import type { ProvisionalAttendanceEntry, ProvisionalPlayer } from '../../types'

export function GuestPlayerDialog({ players, unavailableIds, onAdd, onClose }: {
  players: ProvisionalPlayer[]
  unavailableIds: Set<string>
  onAdd: (entry: ProvisionalAttendanceEntry) => void
  onClose: () => void
}) {
  const available = players.filter((player) => !unavailableIds.has(player.id))
  const [existingId, setExistingId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const titleId = 'guest-player-dialog-title'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (existingId) {
      const player = available.find((item) => item.id === existingId)
      if (!player) return setError('La invitada seleccionada ya no está disponible.')
      onAdd({ id: player.id, displayName: player.display_name })
      onClose()
      return
    }

    const normalizedName = displayName.trim().replace(/\s+/g, ' ')
    if (normalizedName.length < 3 || normalizedName.length > 80 || !/^\S+\s+\S+/.test(normalizedName)) {
      setError('Escribe el nombre y al menos un apellido (entre 3 y 80 caracteres).')
      return
    }
    onAdd({ displayName: normalizedName })
    onClose()
  }

  return <Modal className="guest-player-dialog" labelledBy={titleId} onClose={onClose} onSubmit={submit}>
    <div className="task-detail-heading">
      <div><span className="eyebrow">ASISTENCIA</span><h2 id={titleId}>Añadir invitada</h2></div>
      <button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button>
    </div>
    <p className="guest-player-help">Añádela por su nombre. Si vuelve otro día, podrás reutilizar este registro y vincular todo su historial cuando cree su cuenta.</p>
    {available.length > 0 && <label>Invitada anterior
      <select aria-label="Invitada anterior" onChange={(event) => { setExistingId(event.target.value); setError('') }} value={existingId}>
        <option value="">Es una invitada nueva</option>
        {available.map((player) => <option key={player.id} value={player.id}>{player.display_name}</option>)}
      </select>
    </label>}
    {!existingId && <label>Nombre y apellidos
      <input autoComplete="off" autoFocus maxLength={80} onChange={(event) => { setDisplayName(event.target.value); setError('') }} placeholder="Ej. María López Pérez" value={displayName} />
    </label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">
      <button className="secondary-button" onClick={onClose} type="button">Cancelar</button>
      <button className="primary-button">Añadir invitada</button>
    </div>
  </Modal>
}
