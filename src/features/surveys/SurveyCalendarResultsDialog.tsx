import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { participationPercentage } from './surveySelectors'

export type SurveyCalendarResults = {
  title: string
  responses: number
  recipients: number
  questions: { prompt: string; options: { label: string; count: number }[] }[]
}

export function SurveyCalendarResultsDialog({ surveyId, title, onClose, onLoad }: { surveyId: string; title?: string; onClose: () => void; onLoad: (surveyId: string) => Promise<SurveyCalendarResults> }) {
  const [results, setResults] = useState<SurveyCalendarResults | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; void onLoad(surveyId).then((value) => { if (active) setResults(value) }).catch(() => { if (active) setError('No se pudieron cargar los resultados.') }); return () => { active = false } }, [onLoad, surveyId])
  return <Modal className="survey-results-dialog" labelledBy="calendar-survey-results-title" onClose={onClose}>
    <div className="panel-form-heading"><div><span className="eyebrow">RESULTADOS</span><h2 id="calendar-survey-results-title">{results?.title ?? title ?? 'Encuesta'}</h2></div><button aria-label="Cerrar resultados" className="icon-button" onClick={onClose} type="button">×</button></div>
    {error && <p className="form-error">{error}</p>}
    {!error && !results && <p>Cargando resultados…</p>}
    {results && <section className="survey-results"><header><p>{results.responses} de {results.recipients} jugadoras · {participationPercentage(results.responses, results.recipients)}% participación</p></header>{results.questions.map((question, index) => <article className="survey-result" key={question.prompt}><b>{index + 1}</b><div><h3>{question.prompt}</h3>{question.options.map((option) => <div className="survey-bar" key={option.label}><span>{option.label}<small>{option.count} · {participationPercentage(option.count, results.responses)}%</small></span><i><em style={{ width: `${participationPercentage(option.count, results.responses)}%` }} /></i></div>)}</div></article>)}</section>}
  </Modal>
}
