import { Icon } from '../../components/Icon'
import { formatDate } from '../../lib/dates'
import type { TrainingPlan } from '../../types'
import { TacticsBoardPreview } from './TacticsBoard'
import { trainingPlanStatusLabel } from './trainingPlanMappers'

export function TrainingPlanDetail({ plan, onBack, onEdit }: { plan: TrainingPlan; onBack: () => void; onEdit: () => void }) {
  const totalDuration = plan.training_exercises.reduce((total, exercise) => total + exercise.duration_minutes, 0)
  return <div className="page training-detail-page">
    <button className="text-button training-detail-back" onClick={onBack} type="button">← Volver a entrenamientos</button>
    <header className="training-detail-hero">
      <div className="training-detail-hero-main">
        <div className="training-detail-kicker"><span className={`training-plan-status ${plan.status}`}>{trainingPlanStatusLabel(plan.status)}</span><span>{plan.seasons?.name}</span></div>
        <span className="eyebrow">VISTA DEL ENTRENAMIENTO</span><h1>{plan.title}</h1>
        <p className="training-detail-date"><Icon name="calendar" size={17} />{formatDate(plan.session_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div className="training-detail-hero-actions"><div className="training-detail-duration"><strong>{totalDuration}</strong><span>minutos</span></div><button className="secondary-button training-pdf-button" onClick={() => window.print()} type="button"><Icon name="download" size={16} />Guardar PDF</button><button className="primary-button" onClick={onEdit} type="button">Editar entrenamiento</button></div>
    </header>
    <section className="training-detail-overview">
      <article><span className="eyebrow">OBJETIVOS</span><p>{plan.objectives || 'Sin objetivos generales indicados.'}</p></article>
      {plan.material && <article><span className="eyebrow">MATERIAL</span><p>{plan.material}</p></article>}
      <div className="training-detail-summary"><span><strong>{plan.training_exercises.length}</strong> ejercicios</span><span><strong>{plan.training_exercises.filter((exercise) => exercise.diagram_data.elements.length).length}</strong> esquemas</span></div>
    </section>
    <div className="training-detail-section-heading"><span className="eyebrow">DESARROLLO DE LA SESIÓN</span><h2>Ejercicios</h2></div>
    <div className="training-detail-exercises">{plan.training_exercises.map((exercise, index) => <article className="training-detail-exercise" key={exercise.id}>
      <header><span className="training-detail-number">{index + 1}</span><div><h3>{exercise.title}</h3><p>Ejercicio {index + 1} de {plan.training_exercises.length}</p></div><span className="training-detail-exercise-time"><Icon name="clock" size={16} /><strong>{exercise.duration_minutes}</strong> min</span></header>
      <div className={`training-detail-exercise-body${exercise.diagram_data.elements.length ? '' : ' without-board'}`}>
        <div className="training-detail-instructions"><section><span className="eyebrow">DESARROLLO</span><p>{exercise.description || 'Sin descripción.'}</p></section></div>
        {exercise.diagram_data.elements.length > 0 && <div className="training-detail-board"><div><span className="eyebrow">ESQUEMA</span><small>{exercise.diagram_data.template === 'full' ? 'Campo completo' : exercise.diagram_data.template === 'half' ? 'Medio campo' : 'Zona de 22'}</small></div><TacticsBoardPreview data={exercise.diagram_data} label={`Esquema táctico de ${exercise.title}`} /></div>}
      </div>
    </article>)}</div>
    <div className="training-detail-footer"><button className="secondary-button" onClick={onBack} type="button">Volver</button><button className="primary-button" onClick={onEdit} type="button">Editar entrenamiento</button></div>
  </div>
}
