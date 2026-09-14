import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { fetchSurveyForResponse, submitSurveyResponse } from '../../services/surveysService'
import { SurveyResponseForm } from './SurveyResponseForm'
import type { SurveyForResponse } from '../../services/surveysService'

export function SurveyResponseDialog({ surveyId, initialSurvey, onClose, onDone }: { surveyId: string; initialSurvey?: SurveyForResponse; onClose: () => void; onDone: () => Promise<void> }) {
  const [survey, setSurvey] = useState<SurveyForResponse | null>(initialSurvey ?? null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (initialSurvey) { setSurvey(initialSurvey); setError(''); return }
    let active = true
    void fetchSurveyForResponse(surveyId).then((value) => { if (active) setSurvey(value) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la encuesta.') })
    return () => { active = false }
  }, [initialSurvey, surveyId])
  return <Modal className="survey-response-dialog" labelledBy="survey-response-title" onClose={onClose}>
    <div className="panel-form-heading"><div><span className="eyebrow">ENCUESTA PENDIENTE</span><h2 id="survey-response-title">{survey?.title ?? 'Cargando encuesta…'}</h2></div><div className="modal-later-actions"><button className="text-button" onClick={onClose} type="button">Responder más tarde</button><button aria-label="Cerrar encuesta" className="icon-button" onClick={onClose} type="button">×</button></div></div>
    {error && <p className="form-error">{error}</p>}
    {!error && !survey && <p>Cargando preguntas…</p>}
    {survey?.description && <p className="survey-description">{survey.description}</p>}
    {survey && <SurveyResponseForm questions={survey.questions} onSubmit={async (answers) => { await submitSurveyResponse(survey.id, answers); await onDone() }} />}
  </Modal>
}
