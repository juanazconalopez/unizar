import { useId, useState, type FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import type { Match, MatchLineup, Profile } from '../../types'

export function TrainingPlayerExceptionDialog({ match, players, lineup, historical, onClose, onSave }: {
  match: Match
  players: Profile[]
  lineup: MatchLineup[]
  historical: boolean
  onClose: () => void
  onSave: (playerId: string, reason: string, slotNumber?: number) => Promise<void>
}) {
  const titleId = useId()
  const [playerId, setPlayerId] = useState('')
  const [reason, setReason] = useState('')
  const [slot, setSlot] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const slots = Array.from({ length: match.match_kind === 'official' ? 23 : match.rugby_format === 'sevens' ? 7 : 15 }, (_, index) => index + 1)
    .filter((number) => !lineup.some((entry) => entry.slot_number === number))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !playerId || (historical && (!slot || !confirmed))) return
    setSaving(true); setError('')
    try { await onSave(playerId, reason, historical ? Number(slot) : undefined); onClose() }
    catch (caught) { setError(errorText(caught)); setSaving(false) }
  }

  return <Modal className="availability-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={submit}>
    <div className="task-detail-heading"><div><span className="eyebrow">PARTICIPACIÓN EXCEPCIONAL</span><h2 id={titleId}>Añadir de solo entrenamientos</h2><p>{match.season_teams?.name ?? match.opponent}</p></div><button aria-label="Cerrar" className="icon-button" disabled={saving} onClick={onClose} type="button">×</button></div>
    <p>La autorización solo sirve para este partido. La jugadora conservará su ficha Solo entrenamientos y quedará disponible para la convocatoria.</p>
    <fieldset disabled={saving}>
      <label>Jugadora<select aria-label="Jugadora" autoFocus required onChange={(event) => setPlayerId(event.target.value)} value={playerId}><option value="">Selecciona una jugadora</option>{players.map((player) => <option key={player.id} value={player.id}>{player.display_name}</option>)}</select></label>
      {!players.length && <p>No hay jugadoras de solo entrenamientos pendientes de añadir en esta fecha.</p>}
      {historical && <>
        <p>Se incorporará a la convocatoria de este partido ya disputado. Después revisa Resultado y minutos.</p>
        <label>Dorsal del acta<select aria-label="Dorsal del acta" required onChange={(event) => setSlot(event.target.value)} value={slot}><option value="">Selecciona el dorsal</option>{slots.map((number) => <option key={number} value={number}>{number}</option>)}</select></label>
        <label className="publish-lineup"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />Confirmo que esta jugadora participó en este equipo y con este dorsal.</label>
      </>}
      <label>Motivo opcional<textarea maxLength={500} onChange={(event) => setReason(event.target.value)} rows={3} value={reason} /></label>
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={saving || !playerId || (historical && (!slot || !confirmed))}>{saving ? 'Añadiendo…' : 'Añadir al partido'}</button></div>
  </Modal>
}
