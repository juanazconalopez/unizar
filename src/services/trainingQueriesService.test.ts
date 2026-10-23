import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

type QueryBuilder = {
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise<unknown>
}

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))

import { makeSession } from '../test/fixtures'

import { fetchAttendanceDate, fetchAttendanceForSessions, fetchMatchWindow, fetchStatisticsSeason, fetchStatisticsWindow, fetchTaskWindow } from './trainingQueriesService'

function query(data: unknown[]): QueryBuilder {
  const builder = {} as QueryBuilder
  let from = 0
  let to = Infinity
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.range = vi.fn((start: number, end: number) => { from = start; to = end; return builder })
  builder.select = vi.fn(() => builder)
  builder.then = (resolve) => Promise.resolve({ data: data.slice(from, to + 1), error: null }).then(resolve)
  return builder
}

describe('training data queries', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  test('excluye las sesiones futuras antes de solicitar filas de asistencia', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T20:00:00+02:00'))
    const builder = query([])
    mocks.from.mockReturnValue(builder)
    const actual = makeSession({ id: 'actual', session_date: '2026-10-22' })
    const future = makeSession({ id: 'future', session_date: '2026-10-30' })
    const result = await fetchAttendanceForSessions([actual, future])
    expect(result.trainingSessions).toEqual([actual])
    expect(builder.in).toHaveBeenCalledWith('session_id', ['actual'])
    mocks.from.mockClear()
    expect((await fetchAttendanceForSessions([future])).trainingSessions).toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('acota a hoy las consultas estadísticas mensuales y de temporada, en hora de Madrid', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T00:30:00+02:00'))
    const sessions = query([])
    mocks.from.mockReturnValue(sessions)
    await fetchStatisticsWindow('2026-10-01', { tasks: false, attendance: true })
    expect(sessions.lte).toHaveBeenCalledWith('session_date', '2026-10-23')
    sessions.lte.mockClear()
    await fetchStatisticsSeason('season-1', '2026-09-01', '2027-06-30', { tasks: false, attendance: true })
    expect(sessions.lte).toHaveBeenCalledWith('session_date', '2026-10-23')
  })

  test('does not request announcements when home loads its limited agenda separately', async () => {
    mocks.from.mockReturnValue(query([]))

    const data = await fetchTaskWindow('player-1', false, '2026-08-03', '2026-08-03', { includeAnnouncements: false })

    expect(mocks.from).toHaveBeenCalledOnce()
    expect(mocks.from).toHaveBeenCalledWith('tasks')
    expect(data.announcements).toEqual([])
  })

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
    const announcements = query([])
    mocks.from.mockImplementation((table: string) => table === 'tasks' ? tasks : table === 'team_announcements' ? announcements : results)

    const data = await fetchTaskWindow('player-1', false, '2026-08-03', '2026-08-10')
    expect(tasks.gte).toHaveBeenCalledWith('week_start', '2026-08-03')
    expect(tasks.lte).toHaveBeenCalledWith('week_start', '2026-08-10')
    expect(results.in).toHaveBeenCalledWith('task_id', ['task-1'])
    expect(results.eq).toHaveBeenCalledWith('player_id', 'player-1')
    expect(data.tasks).toHaveLength(1)
    expect(data.results).toHaveLength(1)
    expect(announcements.gte).toHaveBeenCalledWith('announcement_date', '2026-08-03')
    expect(announcements.lte).toHaveBeenCalledWith('announcement_date', '2026-08-16')
  })

  test('loads related availability and lineup only for matches in the range', async () => {
    const matches = query([{
      id: 'match-1', season_id: 'season-1', opponent: 'Fénix', match_date: '2026-09-12',
      kickoff_time: null, venue: null, is_home: true, notes: null, status: 'published',
      match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1',
      created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', seasons: { name: '2026' },
    }])
    mocks.rpc.mockReturnValue(query([]))
    const lineup = query([])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'matches') return matches
      return lineup
    })

    const data = await fetchMatchWindow('2026-09-01', '2026-09-30')
    expect(matches.gte).toHaveBeenCalledWith('match_date', '2026-09-01')
    expect(matches.lte).toHaveBeenCalledWith('match_date', '2026-09-30')
    expect(mocks.rpc).toHaveBeenCalledWith('get_match_availability', { checked_match_ids: ['match-1'] })
    expect(lineup.in).toHaveBeenCalledWith('match_id', ['match-1'])
    expect(data.matches).toHaveLength(1)
  })

  test('loads shared derby responses even when a coach only receives the away match', async () => {
    const away = { id: 'away', internal_fixture_id: 'derby', match_date: '2026-10-10' }
    const sharedResponse = { match_id: 'away', player_id: 'player-b', status: 'available', comment: null, updated_at: '2026-10-01T10:00:00Z' }
    const matches = query([away])
    mocks.from.mockImplementation((table: string) => table === 'matches' ? matches : query([]))
    mocks.rpc.mockReturnValue(query([sharedResponse]))
    const result = await fetchMatchWindow('2026-10-01', '2026-10-31')
    expect(result.matchAvailability).toEqual([sharedResponse])
    expect(mocks.rpc).toHaveBeenCalledWith('get_match_availability', { checked_match_ids: ['away'] })
    expect(mocks.from).not.toHaveBeenCalledWith('match_availability')
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
    const provisionalAttendance = query([{
      session_id: 'session-1', provisional_player_id: 'guest-1', marked_by: 'owner-1',
      updated_at: '2026-08-05T10:00:00Z', training_sessions: { session_date: '2026-08-05' },
    }])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'training_sessions') return sessions
      return table === 'training_attendance' ? attendance : provisionalAttendance
    })

    const data = await fetchAttendanceDate('2026-08-05')
    expect(sessions.eq).toHaveBeenCalledWith('session_date', '2026-08-05')
    expect(attendance.in).toHaveBeenCalledWith('session_id', ['session-1'])
    expect(data.attendance[0]?.training_sessions?.session_date).toBe('2026-08-05')
    expect(data.provisionalAttendance[0]?.provisional_player_id).toBe('guest-1')
  })

  test('does not request provisional attendance for a player personal history', async () => {
    const session = {
      id: 'session-1', season_id: 'season-1', session_date: '2026-08-05', created_by: 'owner-1',
      created_at: '2026-08-05T10:00:00Z', updated_at: '2026-08-05T10:00:00Z',
    }
    const attendance = query([])
    mocks.from.mockReturnValue(attendance)

    const data = await fetchAttendanceForSessions([session], 'player-1')

    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('training_attendance')
    expect(attendance.eq).toHaveBeenCalledWith('player_id', 'player-1')
    expect(data.provisionalAttendance).toEqual([])
  })

  test('keeps every task result and attendance row when the report exceeds 1000 rows', async () => {
    const rows = Array.from({ length: 1201 }, (_, index) => ({ task_id: 'task-1', player_id: `player-${index}` }))
    const resultQuery = query(rows)
    mocks.from.mockImplementation((table: string) => table === 'tasks' ? query([{ id: 'task-1' }])
      : table === 'task_results' ? resultQuery : query([]))
    expect((await fetchTaskWindow('owner-1', true, '2026-08-03', '2026-08-10')).results).toHaveLength(1201)
    expect(resultQuery.range).toHaveBeenCalledTimes(3)
    expect(resultQuery.order).toHaveBeenCalledWith('task_id')
    expect(resultQuery.order).toHaveBeenCalledWith('player_id')

    const attendanceQuery = query(rows.map((row) => ({ session_id: 'session-1', player_id: row.player_id, attended: true })))
    mocks.from.mockImplementation((table: string) => table === 'training_attendance' ? attendanceQuery : query([]))
    const session = { id: 'session-1', season_id: 'season-1', session_date: '2026-08-05', created_by: 'owner-1', created_at: '', updated_at: '' }
    expect((await fetchAttendanceForSessions([session])).attendance).toHaveLength(1201)
  })
})
