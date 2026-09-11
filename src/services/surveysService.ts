import { supabase } from '../lib/supabase'
import type { SurveyAnswerValues, SurveyQuestionForm } from '../features/surveys/SurveyResponseForm'

export type PendingSurvey = { id: string; title: string; description: string | null; startsOn: string; endsOn: string; visibility: 'team' | 'management' | 'private' }

export async function fetchMyPendingSurveys() {
  const { data, error } = await supabase.rpc('get_my_pending_surveys')
  if (error) throw error
  return Array.isArray(data) ? data as PendingSurvey[] : []
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
