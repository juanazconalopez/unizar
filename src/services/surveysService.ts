import { supabase } from '../lib/supabase'
import type { SurveyAnswerValues, SurveyQuestionForm } from '../features/surveys/SurveyResponseForm'

export type PendingSurvey = { id: string; title: string; description: string | null; startsOn: string; endsOn: string; visibility: 'team' | 'management' | 'private' }

export type SurveyVisibility = PendingSurvey['visibility']
export type ManagedSurvey = PendingSurvey & {
  seasonId: string
  status: 'draft' | 'published' | 'cancelled'
  responses: number
  recipients: number
}
export type SurveyDraftQuestion = {
  id?: string
  prompt: string
  type: 'long' | 'single' | 'multiple'
  required: boolean
  options: { id?: string; label: string }[]
}
export type SurveyDraft = Pick<ManagedSurvey, 'id' | 'seasonId' | 'title' | 'description' | 'startsOn' | 'endsOn' | 'visibility'> & {
  questions: SurveyDraftQuestion[]
}
export type SurveyDraftValues = Omit<SurveyDraft, 'id'> & { id?: string | null }
export type SurveyResults = {
  survey: { id: string; title: string; description: string | null; visibility: SurveyVisibility; status: string; startsOn: string; endsOn: string }
  participation: { recipients: number; responses: number }
  questions: { id: string; prompt: string; type: string; options: { id: string; label: string; count: number }[]; longAnswers: { text: string }[] }[]
}

export type SurveyCalendarResults = {
  title: string
  description: string | null
  responses: number
  recipients: number
  questions: { prompt: string; options: { label: string; count: number }[]; longAnswers: { text: string }[] }[]
}

export async function fetchMyPendingSurveys() {
  const { data, error } = await supabase.rpc('get_my_pending_surveys')
  if (error) throw error
  return Array.isArray(data) ? data as PendingSurvey[] : []
}

export async function fetchManageSurveys() {
  const { data, error } = await supabase.rpc('get_manage_surveys')
  if (error) throw error
  return Array.isArray(data) ? data as ManagedSurvey[] : []
}

export async function fetchSurveyDraft(surveyId: string) {
  const { data, error } = await supabase.rpc('get_survey_draft', { checked_survey_id: surveyId })
  if (error) throw error
  if (!data || Array.isArray(data)) throw new Error('El borrador ya no está disponible.')
  return data as SurveyDraft
}

export async function saveSurveyDraft(values: SurveyDraftValues) {
  const { data, error } = await supabase.rpc('save_survey_draft', {
    checked_survey_id: values.id ?? null,
    checked_season_id: values.seasonId,
    checked_title: values.title.trim(),
    checked_description: values.description?.trim() || null,
    checked_starts_on: values.startsOn,
    checked_ends_on: values.endsOn,
    checked_visibility: values.visibility,
    checked_questions: values.questions.map((question) => ({
      prompt: question.prompt.trim(),
      type: question.type,
      required: question.required,
      options: question.options.map((option) => option.label.trim()),
    })),
  })
  if (error) throw error
  return data
}

export async function publishSurvey(surveyId: string) {
  const { error } = await supabase.rpc('publish_survey', { checked_survey_id: surveyId })
  if (error) throw error
}

export async function fetchSurveyResults(surveyId: string) {
  const { data, error } = await supabase.rpc('get_survey_results', { checked_survey_id: surveyId })
  if (error) throw error
  if (!data || Array.isArray(data)) throw new Error('No se pudieron cargar los resultados.')
  return data as SurveyResults
}

export async function fetchSurveyCalendarResults(surveyId: string): Promise<SurveyCalendarResults> {
  const results = await fetchSurveyResults(surveyId)
  return {
    title: results.survey.title,
    description: results.survey.description,
    responses: results.participation.responses,
    recipients: results.participation.recipients,
    questions: results.questions.map((question) => ({
      prompt: question.prompt,
      options: question.options.map((option) => ({ label: option.label, count: option.count })),
      longAnswers: question.longAnswers,
    })),
  }
}

export type SurveyForResponse = { id: string; title: string; description: string | null; endsOn: string; questions: SurveyQuestionForm[] }

export async function fetchSurveyForResponse(surveyId: string) {
  const { data, error } = await supabase.rpc('get_survey_for_response', { checked_survey_id: surveyId })
  if (error) throw error
  if (!data || Array.isArray(data)) throw new Error('La encuesta ya no está disponible.')
  return data as SurveyForResponse
}

export async function submitSurveyResponse(surveyId: string, answers: SurveyAnswerValues[]) {
  const { error } = await supabase.rpc('submit_survey_response', { checked_survey_id: surveyId, submitted_answers: answers })
  if (error) throw error
}

export type SurveyClosure = { id: string; title?: string; result_date: string }

export async function fetchVisibleSurveyClosures(from: string, until: string) {
  const { data, error } = await supabase.rpc('get_visible_survey_closures', { checked_from: from, checked_until: until })
  if (error) throw error
  return Array.isArray(data) ? data as SurveyClosure[] : []
}
