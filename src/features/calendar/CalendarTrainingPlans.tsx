import { Icon } from '../../components/Icon'
import { trainingResponseClosed } from '../../lib/trainingSchedule'
import type { SaveTrainingResponse, TrainingPlanCalendarItem } from '../../types'
import { TrainingResponse } from './TrainingResponse'

export function CalendarTrainingPlans({ plans, onEdit, onOpen, player = false, onRespond }: {
  plans: TrainingPlanCalendarItem[]
  onEdit?: (planId: string) => void
  onOpen?: (planId: string) => void
  player?: boolean
  onRespond?: SaveTrainingResponse
}) {
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
          <TrainingAttendingCount plan={plan} />
          {(player || onRespond) && <TrainingResponse plan={plan} onSave={onRespond} />}
          {!player && (plan.status === 'draft' ? onEdit : onOpen) && <div className="calendar-training-manage">{plan.status === 'draft'
            ? <button className="secondary-button compact" onClick={() => onEdit?.(plan.id)} type="button"><Icon name="edit" size={14} />Editar entrenamiento</button>
            : <button className="secondary-button compact" onClick={() => onOpen?.(plan.id)} type="button">Ver entrenamiento <Icon name="arrow" size={14} /></button>}</div>}
        </div>
      </article>)}
    </div>
  </div>
}

function TrainingAttendingCount({ plan }: { plan: TrainingPlanCalendarItem }) {
  const count = plan.attending_count
  if (count == null) return null
  const label = trainingResponseClosed(plan)
    ? count === 1 ? 'confirmada' : 'confirmadas'
    : count === 1 ? 'asistirá' : 'asistirán'
  return <p aria-label={`${count} ${count === 1 ? 'jugadora ha' : 'jugadoras han'} confirmado su asistencia`} className="training-attending-count" role="status" title="Jugadoras que han respondido «Asistiré».">
    <span className="training-attending-total"><Icon name="users" size={18} /><strong>{count}</strong></span><span>{label}</span>
  </p>
}
