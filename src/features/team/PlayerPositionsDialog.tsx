import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { playingGroups, playingPositions, validPlayerPositions } from '../../lib/playerPositions'
import type { PlayingPosition, SavePlayerPositions } from '../../lib/playerPositions'
import type { Profile } from '../../types'
import './playerPositions.css'

export function PlayerPositionsDialog({ person, onClose, onSave }: { person: Profile; onClose: () => void; onSave: SavePlayerPositions }) {
  const [positions, setPositions] = useState<PlayingPosition[]>(playingPositions.filter((position) => person.playing_positions?.includes(position.value)).map((position) => position.value))
  const [principal, setPrincipal] = useState<PlayingPosition | null>(playingPositions.find((position) => position.value === person.primary_position)?.value ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = { positions, primaryPosition: principal }
    if (!validPlayerPositions(values)) { setError('Elige una posición principal entre las seleccionadas.'); return }
    setSaving(true)
    setError('')
    try { await onSave(person, values); onClose() }
    catch (caught) { setError(errorText(caught)); setSaving(false) }
  }

  return <Modal className="player-positions-dialog" disabled={saving} labelledBy="player-positions-title" onClose={onClose} onSubmit={submit}>
    <div className="task-detail-heading"><div><span className="eyebrow">{person.display_name}</span><h2 id="player-positions-title">Modificar posiciones</h2></div></div>
    <p>Marca las posiciones en las que juega. La principal determina si cuenta como delantera o línea.</p>
    <div className="player-position-options">{playingGroups.filter((group) => group.value !== 'unassigned').map((group) => <fieldset disabled={saving} key={group.value}><legend>{group.label}</legend>{playingPositions.filter((position) => position.group === group.value).map((position) => <label key={position.value}>
      <input checked={positions.includes(position.value)} onChange={(event) => {
        const next = event.target.checked ? playingPositions.filter((option) => positions.includes(option.value) || option.value === position.value).map((option) => option.value) : positions.filter((value) => value !== position.value)
        setPositions(next)
        if (!next.length) setPrincipal(null)
        else if (!principal || !next.includes(principal)) setPrincipal(next[0])
        setError('')
      }} type="checkbox" />{position.label}
    </label>)}</fieldset>)}</div>
    <label className="player-primary-position">Posición principal<select disabled={saving || positions.length === 0} onChange={(event) => setPrincipal(event.target.value as PlayingPosition)} value={principal ?? ''}>
      {!positions.length && <option value="">Sin posición</option>}
      {playingPositions.filter((position) => positions.includes(position.value)).map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}
    </select></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
  </Modal>
}
