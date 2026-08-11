import { beforeEach, describe, expect, test, vi } from 'vitest'

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

import { fetchAttendanceDate, fetchMatchWindow, fetchTaskWindow } from './trainingService'

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

describe('training data queries', () => {
  beforeEach(() => vi.clearAllMocks())

  test('loads only task results related to the requested week and player', async () => {
    const tasks = query([{
      id: 'task-1', season_id: 'season-1', week_start: '2026-08-03', title: 'Tarea',
      description: null, training_type: 'Físico', status: 'published', created_by: 'owner-1',
      created_at: '2026-08-01T10:00:00Z', seasons: { name: '2026' },
    }])
    const results = query([{
      task_id: 'task-1', player_id: 'player-1', result_text: 'Hecho', fatigue_level: 3,
      performed_on: '2026-08-05', completed_at: '2026-08-05T10:00:00Z', updated_at: '2026-08-05T10:00:00Z',
    }])
    mocks.from.mockImplementation((table: string) => table === 'tasks' ? tasks : results)

    const data = await fetchTaskWindow('player-1', false, '2026-08-03', '2026-08-10')
    expect(tasks.gte).toHaveBeenCalledWith('week_start', '2026-08-03')
    expect(tasks.lte).toHaveBeenCalledWith('week_start', '2026-08-10')
    expect(results.in).toHaveBeenCalledWith('task_id', ['task-1'])
    expect(results.eq).toHaveBeenCalledWith('player_id', 'player-1')
    expect(data.tasks).toHaveLength(1)
    expect(data.results).toHaveLength(1)
  })

  test('loads related availability and lineup only for matches in the range', async () => {
    const matches = query([{
      id: 'match-1', season_id: 'season-1', opponent: 'Fénix', match_date: '2026-09-12',
      kickoff_time: null, venue: null, is_home: true, notes: null, status: 'published',
      match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1',
      created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', seasons: { name: '2026' },
    }])
    const availability = query([])
    const lineup = query([])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'matches') return matches
      return table === 'match_availability' ? availability : lineup
    })

    const data = await fetchMatchWindow('2026-09-01', '2026-09-30')
    expect(matches.gte).toHaveBeenCalledWith('match_date', '2026-09-01')
    expect(matches.lte).toHaveBeenCalledWith('match_date', '2026-09-30')
    expect(availability.in).toHaveBeenCalledWith('match_id', ['match-1'])
    expect(lineup.in).toHaveBeenCalledWith('match_id', ['match-1'])
    expect(data.matches).toHaveLength(1)
  })

  test('loads attendance through its session relationship for one date', async () => {
    const sessions = query([{
      id: 'session-1', season_id: 'season-1', session_date: '2026-08-05', created_by: 'owner-1',
      created_at: '2026-08-05T10:00:00Z', updated_at: '2026-08-05T10:00:00Z',
    }])
    const attendance = query([{
      session_id: 'session-1', player_id: 'player-1', attended: true, marked_by: 'owner-1',
      updated_at: '2026-08-05T10:00:00Z', training_sessions: { session_date: '2026-08-05' },
    }])
    mocks.from.mockImplementation((table: string) => table === 'training_sessions' ? sessions : attendance)

    const data = await fetchAttendanceDate('2026-08-05')
    expect(sessions.eq).toHaveBeenCalledWith('session_date', '2026-08-05')
    expect(attendance.in).toHaveBeenCalledWith('session_id', ['session-1'])
    expect(data.attendance[0]?.training_sessions?.session_date).toBe('2026-08-05')
  })
})
