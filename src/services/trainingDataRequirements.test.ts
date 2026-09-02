import { describe, expect, test } from 'vitest'
import { dataRequirementsFor, homeAgendaEnd } from './trainingQueriesService'

describe('training data requirements', () => {
  test('keeps the player home payload small', () => {
    expect(dataRequirementsFor('home', false)).toEqual({
      tasks: true, results: true, memberships: true, profiles: false, attendance: true,
      provisionalPlayers: false, matches: true, announcements: true, seasons: true,
    })
  })

  test('loads team profiles for staff dashboards and task management', () => {
    expect(dataRequirementsFor('home', true).profiles).toBe(true)
    expect(dataRequirementsFor('tasks', false).profiles).toBe(false)
    expect(dataRequirementsFor('tasks', true).profiles).toBe(true)
  })

  test('loads all planning data for the staff calendar', () => {
    expect(dataRequirementsFor('calendar', true)).toEqual({
      tasks: true, results: true, memberships: true, profiles: true, attendance: false,
      provisionalPlayers: false, matches: true, announcements: true, seasons: true,
    })
  })

  test('does not load operational tables for competition', () => {
    expect(dataRequirementsFor('competition', false)).toEqual({
      tasks: false, results: false, memberships: false, profiles: false, attendance: false,
      provisionalPlayers: false, matches: false, announcements: false, seasons: false,
    })
  })

  test('loads only season context for the private training planner', () => {
    expect(dataRequirementsFor('training', true)).toEqual({
      tasks: false, results: false, memberships: false, profiles: false, attendance: false,
      provisionalPlayers: false, matches: false, announcements: false, seasons: true,
    })
  })

  test('loads memberships when attendance needs date-based eligibility', () => {
    expect(dataRequirementsFor('attendance', false).memberships).toBe(true)
    expect(dataRequirementsFor('attendance', true).provisionalPlayers).toBe(true)
  })

  test('limits the home agenda to the end of next week and the active season', () => {
    expect(homeAgendaEnd('2026-08-05', '2026-12-31')).toBe('2026-08-16')
    expect(homeAgendaEnd('2026-08-05', '2026-08-12')).toBe('2026-08-12')
  })
})
