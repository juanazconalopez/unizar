import { describe, expect, test } from 'vitest'
import { canViewSurveyResults, optionPercentages, participationPercentage, surveyIsActive, surveyResultDate } from './surveySelectors'

const survey = { id: 'survey-1', startsOn: '2026-09-08', endsOn: '2026-09-14', status: 'published' as const, visibility: 'team' as const }

describe('survey selectors', () => {
  test('keeps responses available through the full end date and marks results the following day', () => {
    expect(surveyIsActive(survey, '2026-09-08')).toBe(true)
    expect(surveyIsActive(survey, '2026-09-14')).toBe(true)
    expect(surveyIsActive(survey, '2026-09-15')).toBe(false)
    expect(surveyResultDate(survey)).toBe('2026-09-15')
  })

  test('applies the three agreed result visibilities', () => {
    expect(canViewSurveyResults('team', 'player')).toBe(true)
    expect(canViewSurveyResults('management', 'player')).toBe(false)
    expect(canViewSurveyResults('management', 'viewer')).toBe(true)
    expect(canViewSurveyResults('private', 'coach')).toBe(false)
    expect(canViewSurveyResults('private', 'owner')).toBe(true)
  })

  test('calculates participation and multi-select option percentages independently', () => {
    expect(participationPercentage(14, 18)).toBe(78)
    expect(optionPercentages([{ id: 'a', count: 14 }, { id: 'b', count: 8 }], 18)).toEqual([
      { id: 'a', count: 14, percentage: 78 }, { id: 'b', count: 8, percentage: 44 },
    ])
  })
})
