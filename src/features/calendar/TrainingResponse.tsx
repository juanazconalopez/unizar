import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { errorText } from '../../lib/errors'
import { trainingResponseClosed } from '../../lib/trainingSchedule'
import type { SaveTrainingResponse, TrainingPlanCalendarItem } from '../../types'

export function TrainingResponse({ plan, onSave }: { plan: TrainingPlanCalendarItem; onSave?: SaveTrainingResponse }) {
  const [editing, setEditing] = useState(false)
  const [choice, setChoice] = useState(plan.own_attending ?? true)
  const [comment, setComment] = useState(plan.own_comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const closed = trainingResponseClosed(plan, now)
  const answered = plan.own_attending != null
  useEffect(() => {
    if (closed) return
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [closed])

  function edit(attending: boolean) {
    setChoice(attending); setComment(plan.own_comment ?? ''); setEditing(true); setError('')
  }
  async function submit(attending: boolean, text: string) {
    if (!onSave || trainingResponseClosed(plan)) return
    setSaving(true); setError('')
    try { await onSave(plan, attending, text); setEditing(false) } catch (cause) { setError(errorText(cause)) }
    finally { setSaving(false) }
  }
  return <div className={`training-response${answered ? ' training-response-answered' : ''}${editing ? ' training-response-editing' : ''}${closed ? ' training-response-closed' : ''}`}>
    {answered && <p className="training-own-response"><strong className={plan.own_attending ? 'training-response-yes' : 'training-response-no'}><Icon name={plan.own_attending ? 'check' : 'close'} size={16} />Tu respuesta: {plan.own_attending ? 'Asistiré' : 'Rechazado'}</strong></p>}
    {answered && plan.own_comment && <p className="training-own-comment">{plan.own_comment}</p>}
    {plan.response_stale && !closed && <p>La fecha o el horario han cambiado. Confirma de nuevo tu respuesta.</p>}
    {closed ? <small className="training-response-notice">{plan.attendance_recorded ? plan.self_managed ? 'Asistencia registrada automáticamente. La respuesta está cerrada.' : 'Asistencia registrada. La respuesta está cerrada.' : plan.status === 'cancelled' ? 'Entrenamiento cancelado.' : plan.self_managed ? 'Respuesta cerrada. El registro de asistencia es automático.' : 'El plazo de respuesta está cerrado.'}</small>
      : onSave && (editing ? <form onSubmit={(event) => { event.preventDefault(); void submit(choice, comment) }}>
        <label>Tu asistencia<select disabled={saving} value={String(choice)} onChange={(event) => setChoice(event.target.value === 'true')}><option value="true">Asistiré</option><option value="false">Rechazar</option></select></label>
        <label>Comentario (opcional)<textarea disabled={saving} maxLength={500} onChange={(event) => setComment(event.target.value)} rows={2} value={comment} /></label>
        <div className="training-response-actions"><button className="secondary-button compact" disabled={saving} onClick={() => setEditing(false)} type="button">Cancelar</button><button className="primary-button compact" disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar respuesta'}</button></div>
      </form> : answered ? <div className="training-response-actions"><button className="secondary-button compact" disabled={saving} onClick={() => edit(plan.own_attending!)} type="button">Modificar respuesta</button></div>
        : <div className="training-response-actions"><button className="primary-button compact" disabled={saving} onClick={() => void submit(true, '')} type="button">{saving ? 'Guardando…' : 'Asistiré'}</button><button className="secondary-button compact" disabled={saving} onClick={() => edit(false)} type="button">Rechazar</button></div>)}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>
}
