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

export function surveyResultDate(survey: SurveySummary) {
  const date = new Date(`${survey.endsOn}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
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
