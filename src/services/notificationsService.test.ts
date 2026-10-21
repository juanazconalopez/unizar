import { beforeEach, describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../lib/dates'
import { makeMembership } from '../test/fixtures'

type QueryBuilder = {
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise<unknown>
}

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))

import { fetchNotificationFeed } from './notificationsService'

function query(data: unknown[]): QueryBuilder {
  const builder = {} as QueryBuilder
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.range = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: data[0] ?? null, error: null }))
  builder.then = (resolve) => Promise.resolve({ data, error: null }).then(resolve)
  return builder
}

describe('notificationsService', () => {
  beforeEach(() => vi.clearAllMocks())

  test('loads own group notifications only for a covered current season', async () => {
    const empty = query([])
    const season = query([{ id: 'season-1' }])
    mocks.from.mockImplementation((table: string) => table === 'seasons' ? season : empty)
    mocks.rpc.mockImplementation((name: string) => {
      if (name === 'get_player_season_memberships') return Promise.resolve({ data: [makeMembership()], error: null })
      if (name === 'get_training_group_summary') return Promise.resolve({ data: { blocks: [], own_groups: [{ block_id: 'group-1', starts_on: '2026-10-26', color: 'red', notified_at: '2026-10-21T10:00:00Z' }] }, error: null })
      return empty
    })
    const data = await fetchNotificationFeed('player-1', false, true)
    expect(data.trainingGroups).toHaveLength(1)
    expect(mocks.rpc).toHaveBeenCalledWith('get_training_group_summary', { checked_season_id: 'season-1' })
    mocks.rpc.mockClear()
    await fetchNotificationFeed('another-player', false, true)
    expect(mocks.rpc).not.toHaveBeenCalledWith('get_training_group_summary', expect.anything())
  })

  test('loads only the actionable notification window and related user data', async () => {
    const memberships = query([makeMembership()])
    const matches = query([{
      id: 'match-1', season_id: 'season-1', opponent: 'Rival', match_date: addDays(todayIso(), 7),
      kickoff_time: null, venue: null, is_home: true, notes: null, status: 'published',
      match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1',
      created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', seasons: { name: '2026' },
    }])
    const availability = query([])
    const lineups = query([])
    const announcements = query([])
    mocks.from.mockImplementation((table: string) => ({
      season_players: memberships, matches,
      match_availability: availability, match_lineup: lineups, team_announcements: announcements,
    })[table])

    mocks.rpc.mockImplementation((name: string) => name === 'get_player_season_memberships'
      ? Promise.resolve({ data: [makeMembership()], error: null }) : availability)
    const data = await fetchNotificationFeed('player-1')
    expect(matches.lte).toHaveBeenCalledWith('match_date', addDays(todayIso(), 84))
    expect(mocks.rpc).toHaveBeenCalledWith('get_match_availability', { checked_match_ids: ['match-1'], checked_player_id: 'player-1' })
    expect(lineups.in).toHaveBeenCalledWith('match_id', ['match-1'])
    expect(announcements.gte).toHaveBeenCalledWith('announcement_date', todayIso())
    expect(announcements.select).toHaveBeenCalledWith('*, seasons(name)')
    expect(data.tasks).toEqual([])
    expect(mocks.from).not.toHaveBeenCalledWith('tasks')
    expect(mocks.from).not.toHaveBeenCalledWith('task_results')
    expect(mocks.from).not.toHaveBeenCalledWith('match_availability')
    expect(data.matches).toHaveLength(1)

    await fetchNotificationFeed('coach-1', true)
    expect(mocks.rpc).toHaveBeenLastCalledWith('get_match_availability', { checked_match_ids: ['match-1'] })
  })
})
