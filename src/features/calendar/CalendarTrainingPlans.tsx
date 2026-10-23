import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { SectionError, SectionLoading } from '../../components/AsyncViewState'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { trainingResponseClosed } from '../../lib/trainingSchedule'
import type { SaveTrainingResponse, TrainingPlanCalendarItem } from '../../types'
import { TrainingResponse } from './TrainingResponse'

export function CalendarTrainingPlans({ plans, onEdit, onOpen, onLoadAttendees, player = false, onRespond }: {
  plans: TrainingPlanCalendarItem[]
  onEdit?: (planId: string) => void
  onOpen?: (planId: string) => void
  onLoadAttendees?: (planId: string) => Promise<string[]>
  player?: boolean
  onRespond?: SaveTrainingResponse
}) {
  const [attendeesDialog, setAttendeesDialog] = useState<{ plan: TrainingPlanCalendarItem; attendees: string[]; loading: boolean; error: string } | null>(null)

  async function showAttendees(plan: TrainingPlanCalendarItem) {
    if (!onLoadAttendees) return
    setAttendeesDialog({ plan, attendees: [], loading: true, error: '' })
    try {
      const attendees = await onLoadAttendees(plan.id)
      setAttendeesDialog((current) => current?.plan.id === plan.id ? { ...current, attendees, loading: false } : current)
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'No se ha podido cargar la lista de jugadoras.'
      setAttendeesDialog((current) => current?.plan.id === plan.id ? { ...current, error, loading: false } : current)
    }
  }

  if (!plans.length) return null
  return <div className="selected-calendar-group selected-day-trainings">
    <div className="task-week-heading"><h2>Entrenamientos</h2><span>{plans.length}</span></div>
    <div className="calendar-training-list">
      {plans.map((plan) => <article className={`calendar-training-card${plan.status === 'draft' && !player ? ' training-calendar-draft' : ''}`} key={plan.id}>
        <span>E</span>
        <div className="calendar-training-body">
          <div className="calendar-training-info">
            <div className="calendar-training-title"><strong>{plan.title}</strong>{!player && plan.status === 'draft' && <b>Borrador</b>}</div>
            <small>{plan.start_time?.slice(0, 5) ?? '19:30'}–{plan.end_time?.slice(0, 5) ?? '21:30'}{plan.status === 'cancelled' ? ' · Cancelado' : !player && plan.status === 'draft' ? ' · Ejercicios pendientes de publicar' : ''}</small>
            {plan.self_managed && <small>Viernes autogestionado · La asistencia se registra automáticamente al terminar.</small>}
          </div>
          <TrainingAttendingCount onShow={onLoadAttendees ? () => void showAttendees(plan) : undefined} plan={plan} />
          {(player || onRespond) && <TrainingResponse plan={plan} onSave={onRespond} />}
          {!player && (plan.status === 'draft' ? onEdit : onOpen) && <div className="calendar-training-manage">{plan.status === 'draft'
            ? <button className="secondary-button compact" onClick={() => onEdit?.(plan.id)} type="button"><Icon name="edit" size={14} />Editar entrenamiento</button>
            : <button className="secondary-button compact" onClick={() => onOpen?.(plan.id)} type="button">Ver entrenamiento <Icon name="arrow" size={14} /></button>}</div>}
        </div>
      </article>)}
    </div>
    {attendeesDialog && <TrainingAttendeesDialog {...attendeesDialog} onClose={() => setAttendeesDialog(null)} onRetry={() => void showAttendees(attendeesDialog.plan)} />}
  </div>
}

function TrainingAttendingCount({ plan, onShow }: { plan: TrainingPlanCalendarItem; onShow?: () => void }) {
  const count = plan.attending_count
  if (count == null) return null
  const label = trainingResponseClosed(plan)
    ? count === 1 ? 'confirmada' : 'confirmadas'
    : count === 1 ? 'asistirá' : 'asistirán'
  const content = <><span className="training-attending-total"><Icon name="users" size={18} /><strong>{count}</strong></span><span>{label}</span></>
  const accessibleLabel = `${count} ${count === 1 ? 'jugadora ha' : 'jugadoras han'} confirmado su asistencia`
  return onShow
    ? <button aria-haspopup="dialog" aria-label={`${accessibleLabel}. Ver lista de jugadoras`} className="training-attending-count" onClick={onShow} title="Ver las jugadoras que han respondido «Asistiré»." type="button">{content}</button>
    : <p aria-label={accessibleLabel} className="training-attending-count" role="status" title="Jugadoras que han respondido «Asistiré».">{content}</p>
}

function TrainingAttendeesDialog({ plan, attendees, loading, error, onClose, onRetry }: { plan: TrainingPlanCalendarItem; attendees: string[]; loading: boolean; error: string; onClose: () => void; onRetry: () => void }) {
  return <Modal className="training-attendees-dialog" labelledBy="training-attendees-title" onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">ASISTENCIA AL ENTRENAMIENTO</span><h2 id="training-attendees-title">Respuestas «Asistiré»</h2><p>{plan.title}</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button></div>
    {loading ? <SectionLoading /> : error ? <SectionError message={error} onRetry={onRetry} /> : attendees.length
      ? <ul aria-label="Jugadoras que asistirán" className="training-attendees-list">{attendees.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul>
      : <EmptyState title="Nadie ha confirmado todavía" text="La lista incluye las respuestas vigentes «Asistiré»." />}
  </Modal>
}
