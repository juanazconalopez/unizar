import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TrainingPlanValues } from '../types'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), ensureImages: vi.fn(), previousImages: vi.fn(), cleanupImages: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('./contentImagesService', () => ({
  ensureContentImages: mocks.ensureImages,
  contentImageIdsForEntity: mocks.previousImages,
  cleanupContentImages: mocks.cleanupImages,
}))

import { EMPTY_TACTICS_BOARD, isTrainingPlansSchemaMissing, parseTacticsBoard, saveTrainingPlan } from './trainingPlansService'

const values: TrainingPlanValues = {
  seasonId: 'season-1', sessionDate: '2026-10-07', title: 'Organización defensiva',
  objectives: '', material: '', status: 'draft',
  exercises: [{ title: 'Defensa', description: '<strong>Cerrar espacios.</strong>', durationMinutes: 20, diagramData: { version: 1, template: 'full', elements: [] } }],
}

describe('saving an existing training plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ data: 'plan-1', error: null })
    mocks.ensureImages.mockResolvedValue([])
    mocks.previousImages.mockResolvedValue([])
    mocks.cleanupImages.mockResolvedValue(undefined)
  })

  test('sends its existing identifier and date to the atomic save', async () => {
    await expect(saveTrainingPlan('plan-1', values, 'owner-1')).resolves.toBe('plan-1')
    expect(mocks.rpc).toHaveBeenCalledWith('save_training_plan', expect.objectContaining({
      checked_plan_id: 'plan-1', checked_session_date: values.sessionDate,
      checked_exercises: [expect.objectContaining({ description: '<strong>Cerrar espacios.</strong>' })],
    }))
  })

  test('translates only the constraint for another training on the same date', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "training_plans_session_date_key"' } })
    await expect(saveTrainingPlan('plan-1', values, 'owner-1')).rejects.toThrow('Ya existe un entrenamiento planificado para esa fecha.')
  })

  test.each(['training_exercises_order_unique', 'training_exercises_pkey', 'content_image_references_pkey'])('preserves the real database error for %s instead of blaming the date', async (constraint) => {
    const error = { code: '23505', message: `duplicate key value violates unique constraint "${constraint}"`, details: 'Detalles del conflicto', hint: '' }
    mocks.rpc.mockResolvedValue({ data: null, error })
    mocks.ensureImages.mockResolvedValue(['new-image'])
    await expect(saveTrainingPlan('plan-1', values, 'owner-1')).rejects.toBe(error)
    expect(mocks.cleanupImages).toHaveBeenCalledWith(['new-image'])
  })
})

describe('training tactics diagrams', () => {
  test('restores a valid editable board', () => {
    expect(parseTacticsBoard({
      version: 1,
      template: 'half',
      elements: [{ id: 'player-1', type: 'player', x: 120, y: 80, label: '9', scaleX: 0.75, scaleY: 0.75 }],
    })).toEqual({
      version: 1,
      template: 'half',
      elements: [{ id: 'player-1', type: 'player', x: 120, y: 80, label: '9', scaleX: 0.75, scaleY: 0.75 }],
    })
  })

  test('drops malformed elements and uses safe defaults', () => {
    expect(parseTacticsBoard({ template: 'unknown', elements: [
      { id: 'valid', type: 'cone', x: 30, y: 40 },
      { id: 'missing-position', type: 'ball' },
      { id: 'unknown', type: 'car', x: 10, y: 10 },
      { id: 'invalid-scale', type: 'run', x: 10, y: 10, scaleX: 'wide' },
    ] })).toEqual({
      version: 1,
      template: 'full',
      elements: [{ id: 'valid', type: 'cone', x: 30, y: 40 }],
    })
  })

  test('does not share the mutable empty board', () => {
    const parsed = parseTacticsBoard(null)
    parsed.elements.push({ id: 'new', type: 'ball', x: 0, y: 0 })
    expect(EMPTY_TACTICS_BOARD.elements).toEqual([])
  })

  test('recognizes a missing training plans migration', () => {
    expect(isTrainingPlansSchemaMissing({ code: 'PGRST205' })).toBe(true)
    expect(isTrainingPlansSchemaMissing({ message: "Could not find public.training_plans" })).toBe(true)
    expect(isTrainingPlansSchemaMissing({ code: '42501' })).toBe(false)
  })
})
