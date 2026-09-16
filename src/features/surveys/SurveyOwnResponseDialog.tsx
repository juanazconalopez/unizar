import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { fetchMySurveyResponse } from '../../services/surveysService'
import type { MySurveyResponse } from '../../services/surveysService'

export function SurveyOwnResponseDialog({ surveyId, title, initialResponse, onClose }: { surveyId: string; title?: string; initialResponse?: MySurveyResponse; onClose: () => void }) {
  const [response, setResponse] = useState<MySurveyResponse | null>(null)
  const [error, setError] = useState('')
  const displayedResponse = initialResponse ?? response

  useEffect(() => {
    if (initialResponse) return
    let active = true
    void fetchMySurveyResponse(surveyId).then((value) => { if (active) setResponse(value) }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar tu respuesta.')
    })
    return () => { active = false }
  }, [initialResponse, surveyId])

  return <Modal className="survey-results-dialog" labelledBy="own-survey-response-title" onClose={onClose}>
    <div className="panel-form-heading"><div><span className="eyebrow">TU RESPUESTA</span><h2 id="own-survey-response-title">{displayedResponse?.survey.title ?? title ?? 'Encuesta'}</h2></div><button aria-label="Cerrar respuesta" className="icon-button" onClick={onClose} type="button">×</button></div>
    {error && <p className="form-error">{error}</p>}
    {!error && !displayedResponse && <p>Cargando tu respuesta…</p>}
    {displayedResponse?.survey.description && <p className="survey-description">{displayedResponse.survey.description}</p>}
    {displayedResponse && <section className="survey-results survey-own-response">
      <header><p>{displayedResponse.submittedAt ? 'Respuesta enviada.' : 'No enviaste respuesta a esta encuesta.'}</p></header>
      {displayedResponse.questions.map((question, index) => {
        const answer = question.selectedAnswer
        const selectedOptions = question.options.filter((option) => answer?.optionIds.includes(option.id))
        return <article className="survey-result" key={question.id}><b>{index + 1}</b><div><h3>{question.prompt}</h3>{!answer ? <p>Sin respuesta.</p> : <>{selectedOptions.map((option) => <p key={option.id}>{option.label}</p>)}{answer.text && <p>“{answer.text}”</p>}{!selectedOptions.length && !answer.text && <p>Sin respuesta.</p>}</>}</div></article>
      })}
    </section>}
  </Modal>
}
