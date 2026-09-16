export type CalendarSurvey = {
  id: string
  result_date?: string
  title?: string
  state?: 'active' | 'closed'
  responded?: boolean
  visibility?: 'team' | 'management' | 'private'
  startsOn?: string
  endsOn?: string
  respondedOn?: string
  calendarTone?: number
}

export function assignCalendarSurveyTones(surveys: CalendarSurvey[]) {
  const activeSurveyIds = surveys
    .filter((survey) => survey.state === 'active' && survey.startsOn && survey.endsOn)
    .sort((left, right) => left.startsOn!.localeCompare(right.startsOn!) || left.id.localeCompare(right.id))
    .map((survey) => survey.id)
  const toneById = new Map(activeSurveyIds.map((id, index) => [id, index]))
  return surveys.map((survey) => survey.calendarTone === undefined && toneById.has(survey.id)
    ? { ...survey, calendarTone: toneById.get(survey.id) }
    : survey)
}

export function calendarSurveyAppearsOnDate(survey: CalendarSurvey, date: string) {
  if (survey.state === 'active' && survey.startsOn && survey.endsOn) return date >= survey.startsOn && date <= survey.endsOn
  return survey.result_date === date
}
