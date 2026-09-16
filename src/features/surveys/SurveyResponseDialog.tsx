import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { fetchSurveyForResponse, submitSurveyResponse } from '../../services/surveysService'
import { SurveyResponseForm } from './SurveyResponseForm'
import type { SurveyForResponse } from '../../services/surveysService'
import type { SurveyAnswerValues } from './SurveyResponseForm'

export function SurveyResponseDialog({ surveyId, initialSurvey, onClose, onDone, onLoadSurvey = fetchSurveyForResponse, onSubmitResponse = submitSurveyResponse }: { surveyId: string; initialSurvey?: SurveyForResponse; onClose: () => void; onDone: () => Promise<void>; onLoadSurvey?: (surveyId: string) => Promise<SurveyForResponse>; onSubmitResponse?: (surveyId: string, answers: SurveyAnswerValues[]) => Promise<void> }) {
  const [loadedSurvey, setLoadedSurvey] = useState<SurveyForResponse | null>(null)
  const [error, setError] = useState('')
  const survey = initialSurvey ?? loadedSurvey
  useEffect(() => {
    if (initialSurvey) return
    let active = true
    void onLoadSurvey(surveyId).then((value) => { if (active) setLoadedSurvey(value) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la encuesta.') })
    return () => { active = false }
  }, [initialSurvey, onLoadSurvey, surveyId])
  return <Modal className="survey-response-dialog" labelledBy="survey-response-title" onClose={onClose}>
    <div className="panel-form-heading"><div><span className="eyebrow">{survey?.responded ? 'RESPUESTA ENVIADA' : 'ENCUESTA PENDIENTE'}</span><h2 id="survey-response-title">{survey?.title ?? 'Cargando encuesta…'}</h2></div><div className="modal-later-actions"><button aria-label="Responder más tarde y cerrar encuesta" className="primary-button compact" onClick={onClose} type="button">Responder más tarde</button></div></div>
    {error && <p className="form-error">{error}</p>}
    {!error && !survey && <p>Cargando preguntas…</p>}
    {survey?.description && <p className="survey-description">{survey.description}</p>}
    {survey && <SurveyResponseForm answers={survey.answers} questions={survey.questions} submitLabel={survey.responded ? 'Guardar cambios' : 'Enviar respuesta'} onSubmit={async (answers) => { await onSubmitResponse(survey.id, answers); await onDone() }} />}
  </Modal>
}
