import { describe, expect, test } from 'vitest'
import { dataRequirementsFor } from './trainingService'

describe('training data requirements', () => {
  test('keeps the player home payload small', () => {
    expect(dataRequirementsFor('home', false)).toEqual({
      tasks: true,
      results: true,
      memberships: true,
      profiles: false,
      attendance: true,
      matches: false,
      seasons: true,
    })
  })

  test('loads team profiles for task managers only', () => {
    expect(dataRequirementsFor('tasks', false).profiles).toBe(false)
    expect(dataRequirementsFor('tasks', true).profiles).toBe(true)
  })

  test('does not load operational tables for competition', () => {
    expect(dataRequirementsFor('competition', false)).toEqual({
      tasks: false,
      results: false,
      memberships: false,
      profiles: false,
      attendance: false,
      matches: false,
      seasons: false,
    })
  })

  test('loads memberships when attendance needs date-based eligibility', () => {
    expect(dataRequirementsFor('attendance', false).memberships).toBe(true)
  })
})
