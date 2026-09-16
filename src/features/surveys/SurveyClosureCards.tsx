import type { CalendarSurvey } from '../tasks/calendarSurveys'

export function SurveyClosureCards({ surveys, canRespond = false, onModify, onOpen }: { surveys: CalendarSurvey[]; canRespond?: boolean; onModify?: (survey: CalendarSurvey) => void; onOpen?: (survey: CalendarSurvey) => void }) {
  const containsOpenSurvey = surveys.some((survey) => survey.state === 'active')
  return <div className="selected-calendar-group survey-closure-group">
    <div className="task-week-heading"><h2>{containsOpenSurvey ? (canRespond ? 'Encuestas' : 'Resultados provisionales') : 'Resultados de encuestas'}</h2><span>{surveys.length}</span></div>
    <div className="calendar-training-list">{surveys.slice().sort((left, right) => (left.calendarTone ?? Number.MAX_SAFE_INTEGER) - (right.calendarTone ?? Number.MAX_SAFE_INTEGER)).map((survey) => {
      const active = survey.state === 'active'
      const detail = active
        ? canRespond ? (survey.responded ? 'Respuesta enviada. Puedes modificarla hasta el cierre.' : 'Responde antes del cierre de la encuesta.') : 'Resultados provisionales disponibles hasta el cierre.'
        : survey.visibility === 'team' || !survey.visibility ? 'Resultados agregados disponibles' : 'Consulta tu respuesta enviada'
      if (active) return <article className="survey-closure-card survey-active-card" data-survey-tone={survey.calendarTone} key={survey.id}><button aria-label={`Ver detalle de ${survey.title ?? 'encuesta activa'}`} className="survey-active-card-main" onClick={() => onOpen?.(survey)} type="button"><span className="survey-mark">Q</span><span><strong>{survey.title ?? 'Encuesta activa'}</strong><small>{detail}</small></span></button>{canRespond && onModify && <button className="secondary-button compact" onClick={() => onModify(survey)} type="button">{survey.responded ? 'Modificar respuesta' : 'Responder'}</button>}</article>
      return onOpen ? <button className="survey-closure-card" key={survey.id} onClick={() => onOpen(survey)} type="button"><span className="survey-mark">Q</span><span><strong>{survey.title ?? 'Encuesta cerrada'}</strong><small>{detail}</small></span></button> : <article className="survey-closure-card" key={survey.id}><span className="survey-mark">Q</span><div><strong>{survey.title ?? 'Encuesta cerrada'}</strong><small>{detail}</small></div></article>
    })}</div>
  </div>
}
