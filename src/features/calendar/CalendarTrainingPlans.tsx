import { Icon } from '../../components/Icon'
import type { TrainingPlanCalendarItem } from '../../types'

export function CalendarTrainingPlans({ plans, onEdit, onOpen }: {
  plans: TrainingPlanCalendarItem[]
  onEdit?: (planId: string) => void
  onOpen: (planId: string) => void
}) {
  if (!plans.length) return null
  return <div className="selected-calendar-group selected-day-trainings">
    <div className="task-week-heading"><h2>Entrenamientos</h2><span>{plans.length}</span></div>
    <div className="calendar-training-list">
      {plans.map((plan) => <article className={plan.status === 'draft' ? 'training-calendar-draft' : undefined} key={plan.id}>
        <span>E</span>
        <div>
          <div className="calendar-training-title"><strong>{plan.title}</strong>{plan.status === 'draft' && <b>Borrador</b>}</div>
          <small>{plan.status === 'draft' ? 'Solo visible para el equipo técnico' : 'Plan de entrenamiento preparado'}</small>
        </div>
        {plan.status === 'draft'
          ? onEdit && <button className="secondary-button compact" onClick={() => onEdit(plan.id)} type="button"><Icon name="edit" size={14} />Editar entrenamiento</button>
          : <button className="secondary-button compact" onClick={() => onOpen(plan.id)} type="button">Ver entrenamiento <Icon name="arrow" size={14} /></button>}
      </article>)}
    </div>
  </div>
}
