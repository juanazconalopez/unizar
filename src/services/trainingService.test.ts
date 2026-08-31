import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { dataRequirementsFor, homeAgendaEnd, updateOwnProfileDetails } from './trainingService'

describe('training data requirements', () => {
  beforeEach(() => vi.clearAllMocks())

  test('keeps the player home payload small', () => {
    expect(dataRequirementsFor('home', false)).toEqual({
      tasks: true,
      results: true,
      memberships: true,
      profiles: false,
      attendance: true,
      matches: true,
      announcements: true,
      seasons: true,
    })
  })

  test('loads team profiles for staff dashboards and task management', () => {
    expect(dataRequirementsFor('home', true).profiles).toBe(true)
    expect(dataRequirementsFor('tasks', false).profiles).toBe(false)
    expect(dataRequirementsFor('tasks', true).profiles).toBe(true)
  })

  test('loads all planning data for the staff calendar', () => {
    expect(dataRequirementsFor('calendar', true)).toEqual({
      tasks: true,
      results: true,
      memberships: true,
      profiles: true,
      attendance: false,
      matches: true,
      announcements: true,
      seasons: true,
    })
  })

  test('does not load operational tables for competition', () => {
    expect(dataRequirementsFor('competition', false)).toEqual({
      tasks: false,
      results: false,
      memberships: false,
      profiles: false,
      attendance: false,
      matches: false,
      announcements: false,
      seasons: false,
    })
  })

  test('loads only season context for the private training planner', () => {
    expect(dataRequirementsFor('training', true)).toEqual({
      tasks: false,
      results: false,
      memberships: false,
      profiles: false,
      attendance: false,
      matches: false,
      announcements: false,
      seasons: true,
    })
  })

  test('loads memberships when attendance needs date-based eligibility', () => {
    expect(dataRequirementsFor('attendance', false).memberships).toBe(true)
  })

  test('updates the authenticated profile details through the restricted function', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })

    await expect(updateOwnProfileDetails({ displayName: 'María López', phone: '+34 600 123 123', birthDate: '1997-05-12' })).resolves.toBeUndefined()
    expect(mocks.rpc).toHaveBeenCalledWith('update_own_profile_details', {
      new_display_name: 'María López', new_phone: '+34 600 123 123', new_birth_date: '1997-05-12',
    })
  })

  test('limits the home agenda to the end of next week and the active season', () => {
    expect(homeAgendaEnd('2026-08-05', '2026-12-31')).toBe('2026-08-16')
    expect(homeAgendaEnd('2026-08-05', '2026-08-12')).toBe('2026-08-12')
  })
})
