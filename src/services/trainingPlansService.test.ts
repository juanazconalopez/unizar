import { describe, expect, test, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { EMPTY_TACTICS_BOARD, isTrainingPlansSchemaMissing, parseTacticsBoard } from './trainingPlansService'

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
