import { beforeEach, describe, expect, test, vi } from 'vitest'
import { addDays, mondayFor, todayIso } from '../lib/dates'
import { makeMembership, makeTask } from '../test/fixtures'

type QueryBuilder = {
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise<unknown>
}

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { fetchNotificationFeed } from './notificationsService'

function query(data: unknown[]): QueryBuilder {
  const builder = {} as QueryBuilder
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.then = (resolve) => Promise.resolve({ data, error: null }).then(resolve)
  return builder
}

describe('notificationsService', () => {
  beforeEach(() => vi.clearAllMocks())

  test('loads only the actionable notification window and related user data', async () => {
    const tasks = query([{ ...makeTask(), updated_at: '2026-08-07T10:00:00.000Z' }])
    const memberships = query([makeMembership()])
    const matches = query([{
      id: 'match-1', season_id: 'season-1', opponent: 'Rival', match_date: addDays(todayIso(), 7),
      kickoff_time: null, venue: null, is_home: true, notes: null, status: 'published',
      match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1',
      created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', seasons: { name: '2026' },
    }])
    const results = query([])
    const availability = query([])
    const lineups = query([])
    const announcements = query([])
    mocks.from.mockImplementation((table: string) => ({
      tasks, season_players: memberships, matches, task_results: results,
      match_availability: availability, match_lineup: lineups, team_announcements: announcements,
    })[table])

    const data = await fetchNotificationFeed('player-1')
    const currentWeek = mondayFor(todayIso())
    expect(tasks.gte).toHaveBeenCalledWith('week_start', currentWeek)
    expect(tasks.lte).toHaveBeenCalledWith('week_start', addDays(currentWeek, 28))
    expect(results.eq).toHaveBeenCalledWith('player_id', 'player-1')
    expect(availability.eq).toHaveBeenCalledWith('player_id', 'player-1')
    expect(lineups.in).toHaveBeenCalledWith('match_id', ['match-1'])
    expect(announcements.gte).toHaveBeenCalledWith('announcement_date', todayIso())
    expect(data.tasks).toHaveLength(1)
    expect(data.matches).toHaveLength(1)
  })
})
