import { describe, expect, test } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import type { Season, TrainingPlan } from '../../types'
import { initialTrainingPlanValues, upcomingTrainingPlans } from './trainingPlanMappers'

function plan(id: string, sessionDate: string): TrainingPlan {
  return {
    id, season_id: 'season-1', session_date: sessionDate, title: id, objectives: null, material: null,
    status: 'published', created_by: 'owner-1', created_at: '2026-01-01', updated_at: '2026-01-01',
    seasons: { name: 'Temporada' }, training_exercises: [],
  }
}

describe('training plan list selection', () => {
  test('hides past sessions and orders today before later sessions', () => {
    expect(upcomingTrainingPlans([
      plan('Último creado', '2026-09-10'),
      plan('Pasado', '2026-08-30'),
      plan('Hoy', '2026-08-31'),
      plan('Próximo', '2026-09-02'),
    ], '2026-08-31').map((item) => item.id)).toEqual(['Hoy', 'Próximo', 'Último creado'])
  })

  test('copies a training plan into the next available future date', () => {
    const today = todayIso()
    const season: Season = { id: 'season-1', name: 'Temporada', start_date: addDays(today, -20), end_date: addDays(today, 20), created_by: 'owner-1', created_at: today, updated_at: today }
    const values = initialTrainingPlanValues(undefined, plan('Pasado', addDays(today, -10)), [season])

    expect(values.sessionDate).toBe(addDays(today, 1))
    expect(values.seasonId).toBe(season.id)
    expect(values.title).toBe('Copia de Pasado')
  })
})
