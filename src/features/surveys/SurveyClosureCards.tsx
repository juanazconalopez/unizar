import type { CalendarSurvey } from '../tasks/TaskPlanningCalendar'

export function SurveyClosureCards({ surveys, onOpen }: { surveys: CalendarSurvey[]; onOpen?: (surveyId: string) => void }) {
  return <div className="selected-calendar-group survey-closure-group">
    <div className="task-week-heading"><h2>Resultados de encuestas</h2><span>{surveys.length}</span></div>
    <div className="calendar-training-list">{surveys.map((survey) => onOpen ? <button className="survey-closure-card" key={survey.id} onClick={() => onOpen(survey.id)} type="button"><span className="survey-mark">Q</span><span><strong>{survey.title ?? 'Encuesta cerrada'}</strong><small>Resultados agregados disponibles</small></span></button> : <article className="survey-closure-card" key={survey.id}><span className="survey-mark">Q</span><div><strong>{survey.title ?? 'Encuesta cerrada'}</strong><small>Resultados agregados disponibles</small></div></article>)}</div>
  </div>
}
