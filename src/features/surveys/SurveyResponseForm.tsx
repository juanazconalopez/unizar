import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SurveyQuestionType } from './surveySelectors'

export type SurveyQuestionForm = { id: string; prompt: string; type: SurveyQuestionType; required: boolean; options: { id: string; label: string }[] }
export type SurveyAnswerValues = { questionId: string; text?: string; optionIds?: string[] }

export function SurveyResponseForm({ questions, answers = [], onSubmit, submitLabel = 'Enviar respuesta' }: { questions: SurveyQuestionForm[]; answers?: SurveyAnswerValues[]; onSubmit: (answers: SurveyAnswerValues[]) => Promise<void>; submitLabel?: string }) {
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
    {questions.map((question, index) => {
      const initialAnswer = answers.find((answer) => answer.questionId === question.id)
      const selectedOptionIds = new Set(initialAnswer?.optionIds ?? [])
      return <fieldset className="survey-response-question" key={question.id}>
      <legend><span className="survey-question-number">{index + 1}</span><span>{question.prompt}{question.required && <span aria-label="Obligatoria"> *</span>}</span></legend>
      {question.type === 'long' && <textarea defaultValue={initialAnswer?.text ?? ''} name={`text-${question.id}`} rows={5} placeholder="Escribe tu respuesta…" />}
      {question.type !== 'long' && <div className="survey-options">{question.options.map((option) => <label className={`survey-option ${question.type}`} key={option.id}><input defaultChecked={selectedOptionIds.has(option.id)} name={`option-${question.id}`} type={question.type === 'single' ? 'radio' : 'checkbox'} value={option.id} /><span>{option.label}</span></label>)}</div>}
    </fieldset>
    })}
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions"><button className="primary-button" disabled={saving} type="submit">{saving ? 'Guardando…' : submitLabel}</button></div>
  </form>
}
