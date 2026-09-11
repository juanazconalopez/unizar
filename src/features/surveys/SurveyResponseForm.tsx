import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SurveyQuestionType } from './surveySelectors'

export type SurveyQuestionForm = { id: string; prompt: string; type: SurveyQuestionType; required: boolean; options: { id: string; label: string }[] }
export type SurveyAnswerValues = { questionId: string; text?: string; optionIds?: string[] }

export function SurveyResponseForm({ questions, onSubmit }: { questions: SurveyQuestionForm[]; onSubmit: (answers: SurveyAnswerValues[]) => Promise<void> }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const answers = questions.map((question) => ({ questionId: question.id, text: String(form.get(`text-${question.id}`) ?? '').trim(), optionIds: form.getAll(`option-${question.id}`).map(String) }))
    const missing = questions.some((question, index) => question.required && (question.type === 'long' ? !answers[index].text : !answers[index].optionIds.length))
    if (missing) { setError('Responde todas las preguntas obligatorias.'); return }
    setSaving(true); setError('')
    try { await onSubmit(answers) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar la encuesta.') } finally { setSaving(false) }
  }

  return <form className="panel-form survey-response-form" onSubmit={submit}>
    {questions.map((question, index) => <fieldset key={question.id}>
      <legend>{index + 1}. {question.prompt}{question.required && <span aria-label="Obligatoria"> *</span>}</legend>
      {question.type === 'long' && <textarea name={`text-${question.id}`} rows={5} placeholder="Escribe tu respuesta…" />}
      {question.type !== 'long' && <div className="survey-options">{question.options.map((option, optionIndex) => <label key={option.id}><input defaultChecked={question.type === 'single' && optionIndex === 0} name={`option-${question.id}`} type={question.type === 'single' ? 'radio' : 'checkbox'} value={option.id} />{option.label}</label>)}</div>}
    </fieldset>)}
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions"><button className="primary-button" disabled={saving} type="submit">{saving ? 'Enviando…' : 'Enviar respuesta'}</button></div>
  </form>
}
