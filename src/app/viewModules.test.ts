import { expect, test, vi } from 'vitest'
import { makeProfile } from '../test/fixtures'
import { PERMISSIONS } from '../lib/permissions'

const loaded = vi.hoisted(() => ({ player: vi.fn(), staff: vi.fn(), matches: vi.fn() }))
vi.mock('../features/calendar/PlayerCalendarView', () => { loaded.player(); return { PlayerCalendarView: () => null } })
vi.mock('../features/calendar/CalendarView', () => { loaded.staff(); return { CalendarView: () => null } })
vi.mock('../features/matches/MatchesView', () => { loaded.matches(); return { MatchesView: () => null } })

import { preloadAccessibleViews, preloadView } from './viewModules'

test('prepares only accessible modules and the correct calendar for a player', async () => {
  await preloadView('calendar') // A navigation event without identity must not preload both calendars.
  expect(loaded.player).not.toHaveBeenCalled()
  expect(loaded.staff).not.toHaveBeenCalled()
  await preloadAccessibleViews(makeProfile(), [PERMISSIONS.calendar.personal], () => false)
  expect(loaded.player).toHaveBeenCalledOnce()
  expect(loaded.staff).not.toHaveBeenCalled()
  expect(loaded.matches).not.toHaveBeenCalled()
})

test('prepares the management calendar for a coach and stops cancelled queues', async () => {
  await preloadAccessibleViews(makeProfile({ is_coach: true }), [PERMISSIONS.calendar.manage], () => false)
  expect(loaded.staff).toHaveBeenCalledOnce()
  await preloadAccessibleViews(makeProfile(), [PERMISSIONS.matches.teamAvailability], () => true)
  expect(loaded.matches).not.toHaveBeenCalled()
})
