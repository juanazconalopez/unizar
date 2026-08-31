import { beforeEach, describe, expect, test } from 'vitest'
import type { TrainingPlanValues } from '../../types'
import {
  loadTrainingPlanDraft,
  removeTrainingPlanDraft,
  storeTrainingPlanDraft,
  trainingPlanDraftKey,
} from './useTrainingPlanDraft'

const values: TrainingPlanValues = {
  seasonId: 'season-1',
  sessionDate: '2026-09-03',
  title: 'Entrenamiento',
  objectives: 'Objetivos',
  material: 'Conos',
  status: 'draft',
  exercises: [{
    title: 'Defensa',
    description: 'Cerrar espacios.',
    durationMinutes: 20,
    diagramData: { version: 1, template: 'full', elements: [] },
  }],
}

describe('training plan local drafts', () => {
  beforeEach(() => localStorage.clear())

  test('separates drafts by user and editor and restores valid values', () => {
    const key = trainingPlanDraftKey('owner-1', 'plan-1')
    expect(key).not.toBe(trainingPlanDraftKey('owner-2', 'plan-1'))
    expect(key).not.toBe(trainingPlanDraftKey('owner-1', 'plan-2'))

    expect(storeTrainingPlanDraft(key, values)).toBe(true)
    expect(loadTrainingPlanDraft(key)).toEqual(values)

    removeTrainingPlanDraft(key)
    expect(loadTrainingPlanDraft(key)).toBeNull()
  })

  test('discards expired or malformed drafts', () => {
    const expiredKey = trainingPlanDraftKey('owner-1', 'expired')
    localStorage.setItem(expiredKey, JSON.stringify({
      version: 1,
      savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      values,
    }))
    expect(loadTrainingPlanDraft(expiredKey)).toBeNull()
    expect(localStorage.getItem(expiredKey)).toBeNull()

    const malformedKey = trainingPlanDraftKey('owner-1', 'malformed')
    localStorage.setItem(malformedKey, JSON.stringify({ version: 1, savedAt: Date.now(), values: { title: 42 } }))
    expect(loadTrainingPlanDraft(malformedKey)).toBeNull()
    expect(localStorage.getItem(malformedKey)).toBeNull()
  })
})
