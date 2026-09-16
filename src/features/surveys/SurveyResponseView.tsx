import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { fetchSurveyForResponse, submitSurveyResponse } from '../../services/surveysService'
import { SurveyResponseForm } from './SurveyResponseForm'
import type { SurveyForResponse } from '../../services/surveysService'

export function SurveyResponseView({ surveyId, onDone }: { surveyId: string; onDone: () => void }) {
  const [survey, setSurvey] = useState<SurveyForResponse | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void fetchSurveyForResponse(surveyId).then(setSurvey).catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudo cargar la encuesta.')) }, [surveyId])
  if (error) return <section className="page surveys-page"><PageHeader eyebrow="ENCUESTA" title="Encuesta no disponible" subtitle={error} /></section>
  if (!survey) return <section className="page surveys-page"><PageHeader eyebrow="ENCUESTA" title="Cargando encuesta…" subtitle="" /></section>
  return <section className="page surveys-page"><PageHeader eyebrow="ENCUESTA" title={survey.title} subtitle={survey.description ? <span className="survey-header-description">{survey.description}</span> : `Disponible hasta el ${survey.endsOn}.`} />
    <SurveyResponseForm answers={survey.answers} questions={survey.questions} submitLabel={survey.responded ? 'Guardar cambios' : 'Enviar respuesta'} onSubmit={async (answers) => { await submitSurveyResponse(survey.id, answers); onDone() }} />
  </section>
}
