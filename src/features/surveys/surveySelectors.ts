import { addDays } from '../../lib/dates'

export type SurveyVisibility = 'team' | 'management' | 'private'
export type SurveyQuestionType = 'long' | 'single' | 'multiple'

export type SurveySummary = {
  id: string
  startsOn: string
  endsOn: string
  status: 'draft' | 'published' | 'cancelled'
  visibility: SurveyVisibility
}

export function surveyIsActive(survey: SurveySummary, date: string) {
  return survey.status === 'published' && survey.startsOn <= date && date <= survey.endsOn
}

export function surveyStatusLabel(survey: Pick<SurveySummary, 'status' | 'startsOn' | 'endsOn'>, date: string) {
  if (survey.status === 'draft') return 'Borrador'
  if (survey.status === 'cancelled') return 'Cancelada'
  if (date < survey.startsOn) return 'Publicada'
  if (date > survey.endsOn) return 'Finalizada'
  return 'Activa'
}

export function surveyResultDate(survey: SurveySummary) {
  return addDays(survey.endsOn, 1)
}

export function canViewSurveyResults(visibility: SurveyVisibility, role: 'owner' | 'coach' | 'viewer' | 'player') {
  if (role === 'owner') return true
  if (visibility === 'team') return true
  return visibility === 'management' && (role === 'coach' || role === 'viewer')
}

export function participationPercentage(responses: number, recipients: number) {
  return recipients ? Math.round(responses / recipients * 100) : 0
}

export function optionPercentages(options: readonly { id: string; count: number }[], responseCount: number) {
  return options.map((option) => ({ ...option, percentage: responseCount ? Math.round(option.count / responseCount * 100) : 0 }))
}
