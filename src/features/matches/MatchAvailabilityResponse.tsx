import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { addDays, formatDate, todayIso } from '../../lib/dates'
import type { AvailabilityStatus, Match, MatchAvailability } from '../../types'

export function MatchAvailabilityResponse({ initial, match, onSave }: {
  initial?: MatchAvailability
  match: Match
  onSave: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
}) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (match.status !== 'published' || match.match_date < todayIso()) return null
  if (match.lineup_published) return <div className="availability-locked"><strong>Disponibilidad cerrada</strong><span>La convocatoria ya está publicada y no admite cambios.</span></div>

  async function accept() {
    setSaving(true); setError('')
    try { await onSave(match, 'available', '') } catch (caught) { setError(errorText(caught)) } finally { setSaving(false) }
  }

  return <div className="availability-response">
    <p className="availability-deadline">Responde, si es posible, antes del {formatDate(addDays(match.match_date, -2), { day: 'numeric', month: 'long' })}.</p>
    {initial && <div className={`own-availability ${initial.status}`}><span>Tu respuesta</span><strong>{responseLabel(initial.status)}</strong>{initial.comment && <small>{initial.comment}</small>}</div>}
    <div className="availability-response-actions">
      {(!initial || initial.status !== 'available') && <button className="primary-button compact" disabled={saving} onClick={() => void accept()}>{saving ? 'Guardando…' : 'Asistiré'}</button>}
      <button className="secondary-button compact" disabled={saving} onClick={() => setRejectOpen(true)}>{initial ? initial.status === 'available' ? 'Cambiar respuesta' : 'Modificar respuesta' : 'Rechazar'}</button>
    </div>
    {error && <p className="form-error">{error}</p>}
    {rejectOpen && <RejectAvailabilityDialog initial={initial} match={match} onClose={() => setRejectOpen(false)} onSave={async (status, comment) => { await onSave(match, status, comment); setRejectOpen(false) }} />}
  </div>
}

function RejectAvailabilityDialog({ initial, match, onClose, onSave }: {
  initial?: MatchAvailability
  match: Match
  onClose: () => void
  onSave: (status: Exclude<AvailabilityStatus, 'available'>, comment: string) => Promise<void>
}) {
  const titleId = useId()
  const [status, setStatus] = useState<Exclude<AvailabilityStatus, 'available'>>(initial?.status === 'doubt' ? 'doubt' : 'unavailable')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try { await onSave(status, comment) } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }

  return <Modal className="availability-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={submit}>
    <div className="task-detail-heading"><div><span className="eyebrow">DISPONIBILIDAD</span><h2 id={titleId}>Partido contra {match.opponent}</h2></div><button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button></div>
    <label>Respuesta<select autoFocus onChange={(event) => setStatus(event.target.value as Exclude<AvailabilityStatus, 'available'>)} value={status}><option value="doubt">Estoy en duda</option><option value="unavailable">No asistiré</option></select></label>
    <label>Comentario opcional<textarea onChange={(event) => setComment(event.target.value)} placeholder="Lesión, incompatibilidad de horario…" rows={5} value={comment} /></label>
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar respuesta'}</button></div>
  </Modal>
}

function responseLabel(status: AvailabilityStatus) {
  if (status === 'available') return 'Asistirás'
  if (status === 'doubt') return 'Estás en duda'
  return 'No asistirás'
}
