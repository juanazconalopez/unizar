import { describe, expect, test } from 'vitest'
import type { Season } from '../../types'
import { preseasonTrainingPlanValues } from './preseasonDemoPlans'

const season: Season = {
  id: 'season-2026',
  name: 'Temporada 2026/27',
  start_date: '2026-08-01',
  end_date: '2027-06-30',
  created_by: 'owner-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('September preseason drafts', () => {
  const plans = preseasonTrainingPlanValues([season])

  test('plans the first two Tuesdays and Thursdays of September', () => {
    expect(plans.map((plan) => plan.sessionDate)).toEqual([
      '2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10',
    ])
  })

  test('keeps all four sessions as 90-minute drafts', () => {
    plans.forEach((plan) => {
      expect(plan.status).toBe('draft')
      expect(plan.exercises.reduce((total, exercise) => total + exercise.durationMinutes, 0)).toBe(90)
    })
  })

  test('provides an editable tactical drawing for every exercise', () => {
    expect(plans).toHaveLength(4)
    plans.flatMap((plan) => plan.exercises).forEach((exercise) => {
      expect(exercise.diagramData.elements.length).toBeGreaterThan(0)
    })
  })
})
