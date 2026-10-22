import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { addDays, formatDate, mondayFor, todayIso } from '../../lib/dates'
import type { AvailabilityStatus, Match, MatchAvailability } from '../../types'
import { matchTitle } from './matchPresentation'

type CommentAvailabilityStatus = Exclude<AvailabilityStatus, 'available'>

export function MatchAvailabilityResponse({ initial, match, onSave }: {
  initial?: MatchAvailability
  match: Match
  onSave: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
}) {
  const [editingStatus, setEditingStatus] = useState<CommentAvailabilityStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (match.status !== 'published' || match.match_date < todayIso()) return null
  if (match.lineup_published) return <div className="availability-locked"><strong>Disponibilidad cerrada</strong><span>La convocatoria ya está publicada y no admite cambios.</span></div>
  const responseWednesday = addDays(mondayFor(match.match_date), 2)

  async function accept() {
    if (saving) return
    setSaving(true); setError('')
    try { await onSave(match, 'available', '') } catch (caught) { setError(errorText(caught)) } finally { setSaving(false) }
  }

  function editResponse(status: CommentAvailabilityStatus) {
    setError('')
    setEditingStatus(status)
  }

  return <div className="availability-response">
    <p className="availability-deadline">Responde, si es posible, antes del {formatDate(responseWednesday, { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
    {initial && <div className={`own-availability ${initial.status}`}><span>Tu respuesta</span><strong>{responseLabel(initial.status)}</strong>{initial.comment && <small>{initial.comment}</small>}</div>}
    <div className={`availability-response-actions${!initial ? ' availability-response-actions-initial' : ''}`}>
      {(!initial || initial.status !== 'available') && <button className="primary-button compact" disabled={saving} onClick={() => void accept()} type="button">{saving ? 'Guardando…' : 'Asistiré'}</button>}
      {!initial && <button className="secondary-button compact" disabled={saving} onClick={() => editResponse('doubt')} type="button">En duda</button>}
      <button className="secondary-button compact" disabled={saving} onClick={() => editResponse(initial?.status === 'doubt' ? 'doubt' : 'unavailable')} type="button">{initial ? initial.status === 'available' ? 'Cambiar respuesta' : 'Modificar respuesta' : 'No asistiré'}</button>
    </div>
    {error && <p className="form-error">{error}</p>}
    {editingStatus && <AvailabilityCommentDialog initial={initial} initialStatus={editingStatus} match={match} onClose={() => setEditingStatus(null)} onSave={async (status, comment) => { await onSave(match, status, comment); setEditingStatus(null) }} />}
  </div>
}

function AvailabilityCommentDialog({ initial, initialStatus, match, onClose, onSave }: {
  initial?: MatchAvailability
  initialStatus: CommentAvailabilityStatus
  match: Match
  onClose: () => void
  onSave: (status: CommentAvailabilityStatus, comment: string) => Promise<void>
}) {
  const titleId = useId()
  const [status, setStatus] = useState(initialStatus)
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError('')
    try { await onSave(status, comment) } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }

  return <Modal className="availability-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={submit}>
    <div className="task-detail-heading"><div><span className="eyebrow">DISPONIBILIDAD</span><h2 id={titleId}>{matchTitle(match)}</h2></div><button aria-label="Cerrar" className="icon-button" disabled={saving} onClick={onClose} type="button">×</button></div>
    <fieldset disabled={saving}>
      <label>Respuesta<select onChange={(event) => setStatus(event.target.value as CommentAvailabilityStatus)} value={status}><option value="doubt">Estoy en duda</option><option value="unavailable">No asistiré</option></select></label>
      <label>Comentario opcional<textarea autoFocus onChange={(event) => setComment(event.target.value)} placeholder="Lesión, incompatibilidad de horario…" rows={5} spellCheck value={comment} /></label>
    </fieldset>
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar respuesta'}</button></div>
  </Modal>
}

function responseLabel(status: AvailabilityStatus) {
  if (status === 'available') return 'Asistirás'
  if (status === 'doubt') return 'Estás en duda'
  return 'No asistirás'
}
